const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

// 1. Robust Static File Server
const server = http.createServer((req, res) => {
    // Default to index.html for root
    let filePath = req.url === "/" ? "/index.html" : req.url;
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath);

    // Supported mime types
    const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".svg": "image/svg+xml"
    };

    fs.readFile(fullPath, (err, content) => {
        if (err) {
            // 404 handler
            res.writeHead(404);
            res.end("File not found");
        } else {
            res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
            res.end(content);
        }
    });
});

// 2. WebSocket Server
const wss = new WebSocket.Server({ server });
const rooms = {};

wss.on("connection", ws => {
    // Generate a simple unique ID for the user
    ws.id = Math.random().toString(36).substr(2, 9);

    ws.on("message", raw => {
        try {
            const msg = JSON.parse(raw);

            // Handle Joining
            if (msg.type === "JOIN") {
                const roomName = msg.roomId;
                ws.roomId = roomName;

                if (!rooms[roomName]) {
                    rooms[roomName] = { clients: new Set() };
                }
                rooms[roomName].clients.add(ws);

                // Confirm join to self
                ws.send(JSON.stringify({ type: "JOIN_SUCCESS", myId: ws.id }));

                // Notify room of new count
                broadcast(roomName, {
                    type: "PARTNER_UPDATE",
                    count: rooms[roomName].clients.size
                });
            }

            // Handle Sync, Chat, and Emojis
            // We broadcast these to everyone in the room EXCEPT the sender
            if (["SYNC", "CHAT", "EMOJI"].includes(msg.type)) {
                broadcast(ws.roomId, { ...msg, senderId: ws.id }, ws);
            }

        } catch (e) {
            console.error("Invalid message received:", e);
        }
    });

    ws.on("close", () => {
        if (ws.roomId && rooms[ws.roomId]) {
            rooms[ws.roomId].clients.delete(ws);

            // Notify remaining partner
            broadcast(ws.roomId, {
                type: "PARTNER_UPDATE",
                count: rooms[ws.roomId].clients.size
            });

            // Cleanup empty rooms to save memory
            if (rooms[ws.roomId].clients.size === 0) {
                delete rooms[ws.roomId];
            }
        }
    });
});

// Helper: Send message to room, optionally excluding one client (the sender)
function broadcast(roomId, data, excludeWs = null) {
    if (!rooms[roomId]) return;

    const json = JSON.stringify(data);
    rooms[roomId].clients.forEach(client => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(json);
        }
    });
}

server.listen(PORT, "0.0.0.0", () => {
    console.log(`💘 Date Night Server running at http://localhost:${PORT}`);
});