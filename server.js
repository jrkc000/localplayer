const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

// Serve static files
const server = http.createServer((req, res) => {
    let filePath = req.url === "/" ? "/index.html" : req.url;
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

    fs.readFile(fullPath, (err, content) => {
        if (err) { res.writeHead(404); res.end(); }
        else {
            res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
            res.end(content);
        }
    });
});

const wss = new WebSocket.Server({ server });
const rooms = {};

wss.on("connection", ws => {
    ws.id = Math.random().toString(36).slice(2);

    ws.on("message", raw => {
        const msg = JSON.parse(raw);

        // JOIN ROOM
        if (msg.type === "JOIN") {
            ws.roomId = msg.roomId;
            rooms[ws.roomId] ??= { clients: new Set() };
            rooms[ws.roomId].clients.add(ws);

            ws.send(JSON.stringify({ type: "JOIN_SUCCESS", myId: ws.id }));
            broadcast(ws.roomId, { type: "PARTNER_UPDATE", count: rooms[ws.roomId].clients.size });
        }

        // SYNC, CHAT, HEART
        if (["SYNC", "CHAT", "HEART"].includes(msg.type)) {
            broadcast(ws.roomId, { ...msg, senderId: ws.id }, ws); // Exclude sender
        }
    });

    ws.on("close", () => {
        if (ws.roomId && rooms[ws.roomId]) {
            rooms[ws.roomId].clients.delete(ws);
            broadcast(ws.roomId, { type: "PARTNER_UPDATE", count: rooms[ws.roomId].clients.size });
            // Cleanup empty rooms
            if (rooms[ws.roomId].clients.size === 0) delete rooms[ws.roomId];
        }
    });
});

// Helper to send to everyone in room (optionally exclude sender)
function broadcast(roomId, data, excludeWs = null) {
    if (!rooms[roomId]) return;
    const json = JSON.stringify(data);
    rooms[roomId].clients.forEach(client => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(json);
        }
    });
}

server.listen(PORT, "0.0.0.0", () => console.log(`💘 Date Night Server running on port ${PORT}`));