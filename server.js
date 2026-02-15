const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

// ---------- HTTP SERVER ----------
const server = http.createServer((req, res) => {
    let filePath = req.url === "/" ? "/index.html" : req.url;
    const fullPath = path.join(__dirname, filePath);

    const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".ico": "image/x-icon"
    };

    fs.readFile(fullPath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end("Not Found");
        } else {
            res.writeHead(200, {
                "Content-Type": types[path.extname(fullPath)] || "text/plain"
            });
            res.end(content);
        }
    });
});

// ---------- WEBSOCKET ----------
const wss = new WebSocket.Server({ server });
const rooms = {};

function broadcast(roomId, msg, exclude = null) {
    if (!rooms[roomId]) return;
    const data = JSON.stringify(msg);
    rooms[roomId].clients.forEach(c => {
        if (c !== exclude && c.readyState === WebSocket.OPEN) {
            c.send(data);
        }
    });
}

function roomStatus(roomId) {
    const r = rooms[roomId];
    if (!r) return { clientCount: 0, allReady: false };
    const allReady = [...r.clients].every(c => c.isReady);
    return { clientCount: r.clients.size, allReady };
}

wss.on("connection", ws => {
    ws.id = Math.random().toString(36).slice(2);
    ws.roomId = null;
    ws.isReady = false;

    ws.on("message", raw => {
        const msg = JSON.parse(raw);

        if (msg.type === "JOIN") {
            ws.roomId = msg.roomId;
            rooms[msg.roomId] ??= {
                clients: new Set(),
                state: { isPlaying: false, currentTime: 0 }
            };
            rooms[msg.roomId].clients.add(ws);

            ws.send(JSON.stringify({ type: "JOIN_SUCCESS", myId: ws.id }));
            broadcast(msg.roomId, { type: "READY_UPDATE", ...roomStatus(msg.roomId) });
            return;
        }

        const room = rooms[ws.roomId];
        if (!room) return;

        if (msg.type === "READY") {
            ws.isReady = true;
            broadcast(ws.roomId, { type: "READY_UPDATE", ...roomStatus(ws.roomId) });
        }

        if (["PLAY", "PAUSE", "SEEK"].includes(msg.type)) {
            if (msg.type === "PLAY") room.state.isPlaying = true;
            if (msg.type === "PAUSE") room.state.isPlaying = false;
            room.state.currentTime = msg.currentTime;

            broadcast(ws.roomId, {
                type: "SYNC",
                isPlaying: room.state.isPlaying,
                currentTime: room.state.currentTime,
                timestamp: Date.now()
            }, ws);
        }

        if (msg.type === "CHAT") {
            broadcast(ws.roomId, {
                type: "CHAT",
                senderId: ws.id,
                text: msg.text
            });
        }
    });

    ws.on("close", () => {
        if (!ws.roomId || !rooms[ws.roomId]) return;
        rooms[ws.roomId].clients.delete(ws);
        broadcast(ws.roomId, { type: "READY_UPDATE", ...roomStatus(ws.roomId) });
        if (!rooms[ws.roomId].clients.size) delete rooms[ws.roomId];
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});
