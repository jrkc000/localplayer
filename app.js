const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const protocol = location.protocol === "https:" ? "wss" : "ws";
const socketUrl = isLocal ? `${protocol}://${location.hostname}:3000` : `${protocol}://${location.host}`;
const socket = new WebSocket(socketUrl);

const video = document.getElementById("videoPlayer");
const chatInput = document.getElementById("chatInput");
const chatHistory = document.getElementById("chatHistory");
const partnerStatus = document.getElementById("partnerStatus");

let myId, remoteAction = false;

socket.onopen = () => document.getElementById("connectionStatus").innerText = "📡 CONNECTED";

socket.onmessage = e => {
    const msg = JSON.parse(e.data);

    if (msg.type === "JOIN_SUCCESS") myId = msg.myId;

    if (msg.type === "PARTNER_UPDATE") {
        partnerStatus.innerText = msg.count > 1 ? "👤 PARTNER IN" : "👤 WAITING...";
        partnerStatus.style.color = msg.count > 1 ? "#22c55e" : "#888";
    }

    if (msg.type === "SYNC") {
        remoteAction = true;
        // Sync time only if drift is > 1.2 seconds
        if (Math.abs(video.currentTime - msg.currentTime) > 1.2) {
            video.currentTime = msg.currentTime;
        }

        if (msg.isPlaying && video.paused) {
            video.play().catch(() => { });
        } else if (!msg.isPlaying && !video.paused) {
            video.pause();
        }

        // Short delay to allow the browser to register the state change
        setTimeout(() => { remoteAction = false; }, 600);
    }

    if (msg.type === "CHAT") renderChat(msg);
};

document.getElementById("joinBtn").onclick = () => {
    const room = document.getElementById("roomInput").value.trim().toUpperCase();
    if (!room) return;
    socket.send(JSON.stringify({ type: "JOIN", roomId: room }));
    document.getElementById("roomNameDisplay").innerText = `ROOM: ${room}`;
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("playerScreen").classList.remove("hidden");
};

document.getElementById("fileInput").onchange = e => {
    const file = e.target.files[0];
    if (file) {
        video.src = URL.createObjectURL(file);
        document.getElementById("uploadOverlay").classList.add("hidden");
    }
};

// BROADCAST SYNC
["play", "pause", "seeking"].forEach(ev => {
    video.addEventListener(ev, () => {
        if (!remoteAction) {
            socket.send(JSON.stringify({
                type: "SYNC",
                isPlaying: !video.paused,
                currentTime: video.currentTime
            }));
        }
    });
});

// CHAT
const sendChat = () => {
    const text = chatInput.value.trim();
    if (!text) return;
    socket.send(JSON.stringify({ type: "CHAT", text }));
    chatInput.value = "";
};
document.getElementById("sendBtn").onclick = sendChat;
chatInput.onkeydown = e => { if (e.key === "Enter") sendChat(); };

function renderChat(msg) {
    const div = document.createElement("div");
    div.className = `message ${msg.senderId === myId ? "sent" : "received"}`;
    div.textContent = msg.text;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}