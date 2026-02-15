const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

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
    ws.id = Math.random().toString(36).substr(2, 9);

    ws.on("message", raw => {
        try {
            const msg = JSON.parse(raw);

            if (msg.type === "JOIN") {
                const roomName = msg.roomId;
                ws.roomId = roomName;
                rooms[roomName] ??= { clients: new Set() };
                rooms[roomName].clients.add(ws);
                ws.send(JSON.stringify({ type: "JOIN_SUCCESS", myId: ws.id }));
                broadcast(roomName, { type: "PARTNER_UPDATE", count: rooms[roomName].clients.size });
            }

            if (["SYNC", "CHAT", "EMOJI", "TYPING", "IMAGE"].includes(msg.type)) {
                broadcast(ws.roomId, { ...msg, senderId: ws.id }, ws);
            }
        } catch (e) { console.error(e); }
    });

    ws.on("close", () => {
        if (ws.roomId && rooms[ws.roomId]) {
            rooms[ws.roomId].clients.delete(ws);
            broadcast(ws.roomId, { type: "PARTNER_UPDATE", count: rooms[ws.roomId].clients.size });
        }
    });
});

function broadcast(roomId, data, excludeWs = null) {
    if (!rooms[roomId]) return;
    const json = JSON.stringify(data);
    rooms[roomId].clients.forEach(client => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(json);
        }
    });
}

server.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));