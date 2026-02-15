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
    ws.id = Math.random().toString(36).slice(2);

    ws.on("message", raw => {
        const msg = JSON.parse(raw);
        if (msg.type === "JOIN") {
            ws.roomId = msg.roomId;
            rooms[ws.roomId] ??= { clients: new Set() };
            rooms[ws.roomId].clients.add(ws);
            ws.send(JSON.stringify({ type: "JOIN_SUCCESS", myId: ws.id }));

            const update = JSON.stringify({ type: "PARTNER_UPDATE", count: rooms[ws.roomId].clients.size });
            rooms[ws.roomId].clients.forEach(c => c.send(update));
        }

        const room = rooms[ws.roomId];
        if (!room) return;

        if (msg.type === "SYNC" || msg.type === "CHAT") {
            const data = JSON.stringify({ ...msg, senderId: ws.id });
            room.clients.forEach(c => { if (c !== ws) c.send(data); });
        }
    });

    ws.on("close", () => {
        if (ws.roomId && rooms[ws.roomId]) {
            rooms[ws.roomId].clients.delete(ws);
            const update = JSON.stringify({ type: "PARTNER_UPDATE", count: rooms[ws.roomId].clients.size });
            rooms[ws.roomId].clients.forEach(c => c.send(update));
        }
    });
});

server.listen(PORT, "0.0.0.0", () => console.log(`Night Party active on ${PORT}`));