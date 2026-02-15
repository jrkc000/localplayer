const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const protocol = location.protocol === "https:" ? "wss" : "ws";
const socketUrl = isLocal ? `${protocol}://${location.hostname}:3000` : `${protocol}://${location.host}`;
const socket = new WebSocket(socketUrl);

const video = document.getElementById("videoPlayer");
const chatInput = document.getElementById("chatInput");
const chatHistory = document.getElementById("chatHistory");
const partnerStatus = document.getElementById("partnerStatus");
const uploadOverlay = document.getElementById("uploadOverlay");
const typingIndicator = document.getElementById("typingIndicator");

let myId;
let remoteAction = false;
let typingTimeout; // To track when to hide the indicator

socket.onmessage = e => {
    const msg = JSON.parse(e.data);

    if (msg.type === "JOIN_SUCCESS") {
        myId = msg.myId;
        console.log("Connected with ID:", myId);
    }

    if (msg.type === "PARTNER_UPDATE") {
        const hasPartner = msg.count > 1;
        partnerStatus.innerText = hasPartner ? "💞 CONNECTED" : "💔 WAITING...";
        partnerStatus.className = `badge ${hasPartner ? 'online' : 'offline'}`;
        if (hasPartner) addSystemMsg("Partner joined the room.");
        else if (msg.count === 1 && myId) addSystemMsg("Partner left the room.");
    }

    if (msg.type === "SYNC") {
        if (Math.abs(video.currentTime - msg.currentTime) > 0.5) {
            remoteAction = true;
            video.currentTime = msg.currentTime;
        }
        if (msg.isPlaying && video.paused) {
            remoteAction = true;
            video.play().catch(err => console.log("Autoplay blocked:", err));
        } else if (!msg.isPlaying && !video.paused) {
            remoteAction = true;
            video.pause();
        }
        setTimeout(() => { remoteAction = false; }, 400);
    }

    if (msg.type === "CHAT" && msg.senderId !== myId) {
        // Hide typing indicator immediately if they sent the message
        showTypingIndicator(false);
        renderChat(msg.text, "them");
    }

    if (msg.type === "EMOJI" && msg.senderId !== myId) {
        spawnEmoji(msg.emoji);
    }

    // NEW: Handle Typing Event
    if (msg.type === "TYPING" && msg.senderId !== myId) {
        showTypingIndicator(true);
    }
};

// --- USER ACTIONS ---
document.getElementById("joinBtn").onclick = () => {
    const room = document.getElementById("roomInput").value.trim().toUpperCase();
    if (!room) return;
    socket.send(JSON.stringify({ type: "JOIN", roomId: room }));
    document.getElementById("roomNameDisplay").innerText = `ROOM: ${room}`;
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("playerScreen").classList.remove("hidden");
};

document.getElementById("fileInput").onchange = e => {
    const file = e.target.files[0];
    if (file) {
        const fileURL = URL.createObjectURL(file);
        video.src = fileURL;
        uploadOverlay.classList.add("hidden");
        addSystemMsg("Video loaded successfully.");
    }
};

function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    renderChat(text, "me");
    socket.send(JSON.stringify({ type: "CHAT", text }));
    chatInput.value = "";
}

document.getElementById("sendBtn").onclick = sendChat;
chatInput.onkeydown = e => { if (e.key === "Enter") sendChat(); };

// NEW: Detect Typing
chatInput.addEventListener("input", () => {
    socket.send(JSON.stringify({ type: "TYPING" }));
});

// NEW: Typing Indicator Logic
function showTypingIndicator(show) {
    if (show) {
        typingIndicator.classList.remove("hidden");
        // Clear existing timeout if they keep typing
        clearTimeout(typingTimeout);
        // Hide after 2.5 seconds if no new typing event comes in
        typingTimeout = setTimeout(() => {
            typingIndicator.classList.add("hidden");
        }, 2500);
    } else {
        typingIndicator.classList.add("hidden");
        clearTimeout(typingTimeout);
    }
}

// --- EMOJI SYSTEM ---
window.triggerEmoji = (emoji) => {
    spawnEmoji(emoji);
    socket.send(JSON.stringify({ type: "EMOJI", emoji }));
};

function spawnEmoji(emoji) {
    const el = document.createElement("div");
    el.className = "floating-emoji";
    el.innerText = emoji;
    el.style.left = Math.random() * 90 + "%";
    const drift = (Math.random() - 0.5) * 100 + "px";
    const rot = (Math.random() - 0.5) * 50 + "deg";
    el.style.setProperty('--drift-x', drift);
    el.style.setProperty('--rot', rot);
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, 3000);
}

["play", "pause", "seeking"].forEach(event => {
    video.addEventListener(event, () => {
        if (!remoteAction) {
            socket.send(JSON.stringify({
                type: "SYNC",
                isPlaying: !video.paused,
                currentTime: video.currentTime
            }));
        }
    });
});

function renderChat(text, type) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;
    chatHistory.appendChild(div);
    scrollToBottom();
}

function addSystemMsg(text) {
    const div = document.createElement("div");
    div.style.textAlign = "center";
    div.style.fontSize = "0.75rem";
    div.style.color = "#666";
    div.style.margin = "10px 0";
    div.innerText = text;
    chatHistory.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    chatHistory.scrollTop = chatHistory.scrollHeight;
}