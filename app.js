const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const protocol = location.protocol === "https:" ? "wss" : "ws";
const socketUrl = isLocal ? `${protocol}://${location.hostname}:3000` : `${protocol}://${location.host}`;
const socket = new WebSocket(socketUrl);

// ELEMENTS
const video = document.getElementById("videoPlayer");
const chatInput = document.getElementById("chatInput");
const chatHistory = document.getElementById("chatHistory");
const partnerStatus = document.getElementById("partnerStatus");
const uploadOverlay = document.getElementById("uploadOverlay");
const heartsContainer = document.getElementById("heartsContainer");

let myId;
let remoteAction = false;

// --- SOCKET LOGIC ---
socket.onmessage = e => {
    const msg = JSON.parse(e.data);

    if (msg.type === "JOIN_SUCCESS") {
        myId = msg.myId;
    }

    if (msg.type === "PARTNER_UPDATE") {
        const isPartnerHere = msg.count > 1;
        partnerStatus.innerText = isPartnerHere ? "❤️ PARTNER CONNECTED" : "💔 WAITING FOR PARTNER";
        partnerStatus.classList.toggle("online", isPartnerHere);
        partnerStatus.classList.toggle("offline", !isPartnerHere);

        if (isPartnerHere) addSystemMessage("Partner has joined the room.");
    }

    if (msg.type === "SYNC") {
        // Only apply if the difference is significant to avoid stutter
        if (Math.abs(video.currentTime - msg.currentTime) > 0.5) {
            remoteAction = true;
            video.currentTime = msg.currentTime;
        }

        if (msg.isPlaying && video.paused) {
            remoteAction = true;
            video.play().catch(() => { });
        } else if (!msg.isPlaying && !video.paused) {
            remoteAction = true;
            video.pause();
        }

        // Reset lock shortly after
        setTimeout(() => { remoteAction = false; }, 500);
    }

    if (msg.type === "CHAT" && msg.senderId !== myId) {
        renderChat(msg.text, "them");
    }

    if (msg.type === "HEART") {
        spawnFloatingHeart();
    }
};

// --- VIDEO SYNC LOGIC ---
["play", "pause", "seeking"].forEach(ev => {
    video.addEventListener(ev, () => {
        // If the action was triggered by the user (not by code)
        if (!remoteAction) {
            socket.send(JSON.stringify({
                type: "SYNC",
                isPlaying: !video.paused,
                currentTime: video.currentTime
            }));
        }
    });
});

// --- UI LOGIC ---

// 1. Join Room
document.getElementById("joinBtn").onclick = () => {
    const room = document.getElementById("roomInput").value.trim().toUpperCase();
    if (!room) return;
    socket.send(JSON.stringify({ type: "JOIN", roomId: room }));

    document.getElementById("roomNameDisplay").innerText = `ROOM: ${room}`;
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("playerScreen").classList.remove("hidden");
};

// 2. File Upload
document.getElementById("fileInput").onchange = e => {
    const file = e.target.files[0];
    if (file) {
        video.src = URL.createObjectURL(file);
        uploadOverlay.classList.add("hidden");
        addSystemMessage("Video loaded.");
    }
};

// 3. Chat System
function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    renderChat(text, "me");
    socket.send(JSON.stringify({ type: "CHAT", text }));
    chatInput.value = "";
}

function renderChat(text, type) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;
    chatHistory.appendChild(div);
    scrollToBottom();
}

function addSystemMessage(text) {
    const div = document.createElement("div");
    div.className = "system-msg";
    div.innerText = text;
    chatHistory.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

document.getElementById("sendBtn").onclick = sendChat;
chatInput.onkeydown = e => { if (e.key === "Enter") sendChat(); };

// 4. Heart Feature
document.getElementById("heartBtn").onclick = () => {
    spawnFloatingHeart(); // Show on my screen
    socket.send(JSON.stringify({ type: "HEART" })); // Tell partner
};

function spawnFloatingHeart() {
    const heart = document.createElement("div");
    heart.className = "heart-anim";
    heart.innerHTML = "💞";
    heart.style.left = Math.random() * 80 + 10 + "%"; // Random horizontal pos
    heartsContainer.appendChild(heart);
    setTimeout(() => heart.remove(), 2000);
}