// --- DYNAMIC SERVER DETECTION ---
const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const protocol = location.protocol === "https:" ? "wss" : "ws";
const socketUrl = isLocal ? `${protocol}://${location.hostname}:3000` : `${protocol}://${location.host}`;
const socket = new WebSocket(socketUrl);

// UI ELEMENTS
const video = document.getElementById("videoPlayer");
const chatInput = document.getElementById("chatInput");
const chatHistory = document.getElementById("chatHistory");
const partnerStatus = document.getElementById("partnerStatus");
const roomInput = document.getElementById("roomInput");
const loginScreen = document.getElementById("loginScreen");
const playerScreen = document.getElementById("playerScreen");
const uploadOverlay = document.getElementById("uploadOverlay");

let myId, remoteAction = false;

// SOCKET EVENT HANDLERS
socket.onopen = () => {
    document.getElementById("connectionStatus").innerText = "📡 CONNECTED";
};

socket.onmessage = e => {
    const msg = JSON.parse(e.data);

    if (msg.type === "JOIN_SUCCESS") myId = msg.myId;

    if (msg.type === "PARTNER_UPDATE") {
        partnerStatus.innerText = msg.count > 1 ? "👤 PARTNER JOINED" : "👤 WAITING...";
        partnerStatus.style.color = msg.count > 1 ? "#22c55e" : "#888";
    }

    if (msg.type === "SYNC") {
        remoteAction = true;

        // Only jump if we are more than 1.5s apart to prevent stutter
        if (Math.abs(video.currentTime - msg.currentTime) > 1.5) {
            video.currentTime = msg.currentTime;
        }

        // Handle Play/Pause
        if (msg.isPlaying && video.paused) {
            video.play().catch(() => { });
        } else if (!msg.isPlaying && !video.paused) {
            video.pause();
        }

        // Re-enable local controls after sync is processed
        setTimeout(() => { remoteAction = false; }, 600);
    }

    if (msg.type === "CHAT") renderChat(msg);
};

// ACTIONS: JOIN ROOM
document.getElementById("joinBtn").onclick = () => {
    const room = roomInput.value.trim().toUpperCase();
    if (!room) return;
    socket.send(JSON.stringify({ type: "JOIN", roomId: room }));
    document.getElementById("roomNameDisplay").innerText = `ROOM: ${room}`;
    loginScreen.classList.add("hidden");
    playerScreen.classList.remove("hidden");
};

// ACTIONS: FILE SELECT
document.getElementById("fileInput").onchange = e => {
    const file = e.target.files[0];
    if (file) {
        video.src = URL.createObjectURL(file);
        uploadOverlay.classList.add("hidden");
    }
};

// VIDEO SYNC LISTENERS
["play", "pause", "seeking"].forEach(ev => {
    video.addEventListener(ev, () => {
        // Only send update if the user did it (not a remote sync message)
        if (!remoteAction) {
            socket.send(JSON.stringify({
                type: "SYNC",
                isPlaying: !video.paused,
                currentTime: video.currentTime
            }));
        }
    });
});

// CHAT HANDLING (TEXT ONLY)
const sendChat = () => {
    const text = chatInput.value.trim();
    if (!text) return;
    socket.send(JSON.stringify({ type: "CHAT", text }));
    chatInput.value = "";
};

document.getElementById("sendBtn").onclick = sendChat;
chatInput.onkeydown = e => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendChat();
    }
};

function renderChat(msg) {
    const div = document.createElement("div");
    const isMe = msg.senderId === myId;
    div.className = `message ${isMe ? "sent" : "received"}`;
    div.textContent = msg.text;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}