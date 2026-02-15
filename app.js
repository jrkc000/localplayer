const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const protocol = location.protocol === "https:" ? "wss" : "ws";
const socketUrl = isLocal ? `${protocol}://${location.hostname}:3000` : `${protocol}://${location.host}`;
const socket = new WebSocket(socketUrl);

// --- ELEMENTS ---
const video = document.getElementById("videoPlayer");
const chatInput = document.getElementById("chatInput");
const chatHistory = document.getElementById("chatHistory");
const partnerStatus = document.getElementById("partnerStatus");
const uploadOverlay = document.getElementById("uploadOverlay");

let myId;
let remoteAction = false; // Flag to prevent infinite sync loops

// --- SOCKET LOGIC ---
socket.onmessage = e => {
    const msg = JSON.parse(e.data);

    // 1. Connection Established
    if (msg.type === "JOIN_SUCCESS") {
        myId = msg.myId;
        console.log("Connected with ID:", myId);
    }

    // 2. Partner Status Update
    if (msg.type === "PARTNER_UPDATE") {
        const hasPartner = msg.count > 1;
        partnerStatus.innerText = hasPartner ? "💞 CONNECTED" : "💔 WAITING...";
        partnerStatus.className = `badge ${hasPartner ? 'online' : 'offline'}`;

        if (hasPartner) addSystemMsg("Partner joined the room.");
        else if (msg.count === 1 && myId) addSystemMsg("Partner left the room.");
    }

    // 3. Video Sync
    if (msg.type === "SYNC") {
        // Sync Time (Tolerance 0.5s)
        if (Math.abs(video.currentTime - msg.currentTime) > 0.5) {
            remoteAction = true;
            video.currentTime = msg.currentTime;
        }

        // Sync Play/Pause State
        if (msg.isPlaying && video.paused) {
            remoteAction = true;
            video.play().catch(err => console.log("Autoplay blocked:", err));
        } else if (!msg.isPlaying && !video.paused) {
            remoteAction = true;
            video.pause();
        }

        // Reset the lock shortly after
        setTimeout(() => { remoteAction = false; }, 400);
    }

    // 4. Chat Message
    if (msg.type === "CHAT" && msg.senderId !== myId) {
        renderChat(msg.text, "them");
    }

    // 5. Emoji Burst
    if (msg.type === "EMOJI" && msg.senderId !== myId) {
        spawnEmoji(msg.emoji);
    }
};

// --- USER ACTIONS ---

// Join Room
document.getElementById("joinBtn").onclick = () => {
    const room = document.getElementById("roomInput").value.trim().toUpperCase();
    if (!room) return;

    socket.send(JSON.stringify({ type: "JOIN", roomId: room }));

    document.getElementById("roomNameDisplay").innerText = `ROOM: ${room}`;
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("playerScreen").classList.remove("hidden");
};

// Select Video File
document.getElementById("fileInput").onchange = e => {
    const file = e.target.files[0];
    if (file) {
        const fileURL = URL.createObjectURL(file);
        video.src = fileURL;
        uploadOverlay.classList.add("hidden");
        addSystemMsg("Video loaded successfully.");
    }
};

// Send Text Chat
function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    renderChat(text, "me");
    socket.send(JSON.stringify({ type: "CHAT", text }));
    chatInput.value = "";
}

document.getElementById("sendBtn").onclick = sendChat;
chatInput.onkeydown = e => { if (e.key === "Enter") sendChat(); };

// --- EMOJI SYSTEM ---

// Triggered by Button Click
window.triggerEmoji = (emoji) => {
    spawnEmoji(emoji); // Show on my screen
    socket.send(JSON.stringify({ type: "EMOJI", emoji })); // Send to partner
};

function spawnEmoji(emoji) {
    const el = document.createElement("div");
    el.className = "floating-emoji";
    el.innerText = emoji;

    // 1. Randomize horizontal start (0% to 90%)
    el.style.left = Math.random() * 90 + "%";

    // 2. Randomize drift (-50px to +50px)
    const drift = (Math.random() - 0.5) * 100 + "px";

    // 3. Randomize rotation (-25deg to +25deg)
    const rot = (Math.random() - 0.5) * 50 + "deg";

    el.style.setProperty('--drift-x', drift);
    el.style.setProperty('--rot', rot);

    document.body.appendChild(el);

    // Clean up DOM after animation
    setTimeout(() => { el.remove(); }, 3000);
}

// --- SYNC EVENTS ---
// We listen for play/pause/seek. If they happen and 'remoteAction' is false, it means WE did it.
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

// --- UI HELPERS ---
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