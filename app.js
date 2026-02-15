const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const protocol = location.protocol === "https:" ? "wss" : "ws";
const socketUrl = isLocal ? `${protocol}://${location.hostname}:3000` : `${protocol}://${location.host}`;
const socket = new WebSocket(socketUrl);

const video = document.getElementById("videoPlayer");
const chatInput = document.getElementById("chatInput");
const chatHistory = document.getElementById("chatHistory");
const partnerStatus = document.getElementById("partnerStatus");
const uploadOverlay = document.getElementById("uploadOverlay");

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
        if (Math.abs(video.currentTime - msg.currentTime) > 1.2) {
            video.currentTime = msg.currentTime;
        }
        msg.isPlaying ? video.play().catch(() => { }) : video.pause();
        setTimeout(() => { remoteAction = false; }, 600);
    }

    if (msg.type === "CHAT") {
        // Only render if it's from the other person (we already echoed ours)
        if (msg.senderId !== myId) {
            renderChat(msg.text, false);
        }
    }
};

// LOGIN LOGIC
document.getElementById("joinBtn").onclick = () => {
    const room = document.getElementById("roomInput").value.trim().toUpperCase();
    if (!room) return;
    socket.send(JSON.stringify({ type: "JOIN", roomId: room }));
    document.getElementById("roomNameDisplay").innerText = `ROOM: ${room}`;
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("playerScreen").classList.remove("hidden");
};

// VIDEO UPLOAD LOGIC
document.getElementById("fileInput").onchange = e => {
    const file = e.target.files[0];
    if (file) {
        video.src = URL.createObjectURL(file);
        uploadOverlay.classList.add("hidden");
    }
};

// VIDEO SYNC
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

// MESSENGER CHAT LOGIC
const sendChat = () => {
    const text = chatInput.value.trim();
    if (!text) return;

    // Show my own text locally immediately
    renderChat(text, true);

    // Send to partner
    socket.send(JSON.stringify({ type: "CHAT", text, senderId: myId }));
    chatInput.value = "";
};

function renderChat(text, isMe) {
    const div = document.createElement("div");
    div.className = `message ${isMe ? "sent" : "received"}`;
    div.textContent = text;
    chatHistory.appendChild(div);

    // Always scroll to bottom
    setTimeout(() => {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }, 50);
}

document.getElementById("sendBtn").onclick = sendChat;
chatInput.onkeydown = e => { if (e.key === "Enter") sendChat(); };