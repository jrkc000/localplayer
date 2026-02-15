const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const protocol = location.protocol === "https:" ? "wss" : "ws";
const socketUrl = isLocal ? `${protocol}://${location.hostname}:3000` : `${protocol}://${location.host}`;
const socket = new WebSocket(socketUrl);

const video = document.getElementById("videoPlayer");
const chatInput = document.getElementById("chatInput");
const chatHistory = document.getElementById("chatHistory");
const uploadOverlay = document.getElementById("uploadOverlay");
const typingIndicator = document.getElementById("typingIndicator");

// BUTTONS
const imageInput = document.getElementById("imageInput");
const imgBtn = document.getElementById("imgBtn");
const sendBtn = document.getElementById("sendBtn");

let myId, remoteAction = false, typingTimeout;

// --- SOCKET LOGIC ---
socket.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.type === "JOIN_SUCCESS") myId = msg.myId;
    if (msg.type === "SYNC") {
        if (Math.abs(video.currentTime - msg.currentTime) > 0.5) {
            remoteAction = true; video.currentTime = msg.currentTime;
        }
        if (msg.isPlaying !== !video.paused) {
            remoteAction = true;
            msg.isPlaying ? video.play() : video.pause();
        }
        setTimeout(() => { remoteAction = false; }, 400);
    }
    if (msg.type === "CHAT" && msg.senderId !== myId) {
        showTypingIndicator(false); renderChat(msg.text, "them");
    }
    if (msg.type === "EMOJI" && msg.senderId !== myId) spawnEmoji(msg.emoji);
    if (msg.type === "TYPING" && msg.senderId !== myId) showTypingIndicator(true);
    if (msg.type === "IMAGE" && msg.senderId !== myId) renderImage(msg.src, "them");
};

// --- BUTTON TOGGLE LOGIC ---
chatInput.addEventListener('input', () => {
    toggleButtons();
    socket.send(JSON.stringify({ type: "TYPING" }));
});

function toggleButtons() {
    const isEmpty = chatInput.value.trim() === "";
    if (isEmpty) {
        // Show Plus, Hide Send
        imgBtn.classList.remove("hidden");
        sendBtn.classList.add("hidden");
    } else {
        // Hide Plus, Show Send
        imgBtn.classList.add("hidden");
        sendBtn.classList.remove("hidden");
    }
}

// --- SENDING ---
function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    renderChat(text, "me");
    socket.send(JSON.stringify({ type: "CHAT", text }));

    chatInput.value = "";
    toggleButtons();
    scrollToBottom();
}

document.getElementById("sendBtn").onclick = sendChat;
chatInput.onkeydown = e => { if (e.key === "Enter") sendChat(); };

// --- IMAGE UPLOAD (NO LIMIT) ---
imgBtn.onclick = () => imageInput.click();

imageInput.onchange = e => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const base64 = event.target.result;
            socket.send(JSON.stringify({ type: "IMAGE", src: base64 }));
            renderImage(base64, "me");
        };
        reader.readAsDataURL(file);
    }
    imageInput.value = "";
};

// --- REST OF APP ---
document.getElementById("joinBtn").onclick = () => {
    const room = document.getElementById("roomInput").value.trim().toUpperCase();
    if (!room) return;
    socket.send(JSON.stringify({ type: "JOIN", roomId: room }));
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("playerScreen").classList.remove("hidden");
};

document.getElementById("fileInput").onchange = e => {
    const file = e.target.files[0];
    if (file) {
        video.src = URL.createObjectURL(file);
        uploadOverlay.classList.add("hidden");
    }
};

function showTypingIndicator(show) {
    if (show) {
        typingIndicator.classList.remove("hidden");
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => { typingIndicator.classList.add("hidden"); }, 2500);
    } else {
        typingIndicator.classList.add("hidden");
        clearTimeout(typingTimeout);
    }
}

window.triggerEmoji = (emoji) => { spawnEmoji(emoji); socket.send(JSON.stringify({ type: "EMOJI", emoji })); };

function spawnEmoji(emoji) {
    const el = document.createElement("div");
    el.className = "floating-emoji";
    el.innerText = emoji;
    el.style.left = Math.random() * 90 + "%";
    el.style.setProperty('--drift-x', (Math.random() - 0.5) * 100 + "px");
    el.style.setProperty('--rot', (Math.random() - 0.5) * 50 + "deg");
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, 3000);
}

["play", "pause", "seeking"].forEach(event => {
    video.addEventListener(event, () => {
        if (!remoteAction) socket.send(JSON.stringify({ type: "SYNC", isPlaying: !video.paused, currentTime: video.currentTime }));
    });
});

function renderChat(text, type) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;
    chatHistory.appendChild(div);
    scrollToBottom();
}

function renderImage(src, type) {
    const div = document.createElement("div");
    div.className = `msg ${type} msg-img`;
    const img = document.createElement("img");
    img.src = src;
    div.appendChild(img);
    chatHistory.appendChild(div);
    scrollToBottom();
}

// --- SCROLL FIXES (The "Underground" Fix) ---
chatInput.addEventListener("focus", () => {
    setTimeout(scrollToBottom, 300); // Wait for keyboard
});

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        scrollToBottom();
        setTimeout(scrollToBottom, 100);
    });
} else {
    window.addEventListener('resize', () => {
        scrollToBottom();
    });
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    });
}