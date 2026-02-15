const protocol = location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${protocol}://${location.host}`);

const loginScreen = document.getElementById("loginScreen");
const playerScreen = document.getElementById("playerScreen");
const joinBtn = document.getElementById("joinBtn");
const roomInput = document.getElementById("roomInput");

const video = document.getElementById("videoPlayer");
const fileInput = document.getElementById("fileInput");
const readyBtn = document.getElementById("readyBtn");

const chatInput = document.getElementById("chatInput");
const chatHistory = document.getElementById("chatHistory");
const sendBtn = document.getElementById("sendBtn");

let myId;
let started = false;
let remote = false;

joinBtn.onclick = () => {
  const room = roomInput.value.trim().toUpperCase();
  if (!room) return alert("Enter room name");
  socket.send(JSON.stringify({ type: "JOIN", roomId: room }));
  loginScreen.classList.add("hidden");
  playerScreen.classList.remove("hidden");
};

socket.onmessage = e => {
  const msg = JSON.parse(e.data);

  if (msg.type === "JOIN_SUCCESS") myId = msg.myId;

  if (msg.type === "READY_UPDATE" && msg.allReady) {
    document.getElementById("readyOverlay").classList.add("hidden");
    started = true;
  }

  if (msg.type === "SYNC") {
    remote = true;
    video.currentTime = msg.currentTime;
    msg.isPlaying ? video.play() : video.pause();
    setTimeout(() => remote = false, 300);
  }

  if (msg.type === "CHAT") renderChat(msg);
};

fileInput.onchange = e => {
  video.src = URL.createObjectURL(e.target.files[0]);
  document.getElementById("uploadOverlay").classList.add("hidden");
  document.getElementById("readyOverlay").classList.remove("hidden");
};

readyBtn.onclick = () => {
  socket.send(JSON.stringify({ type: "READY" }));
  readyBtn.disabled = true;
};

["play", "pause", "seeked"].forEach(ev =>
  video.addEventListener(ev, () => {
    if (started && !remote) {
      socket.send(JSON.stringify({
        type: ev.toUpperCase(),
        currentTime: video.currentTime
      }));
    }
  })
);

sendBtn.onclick = () => sendChat(chatInput.innerText.trim());
chatInput.onkeydown = e => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendChat(chatInput.innerText.trim());
  }
};

function sendChat(text) {
  if (!text) return;
  socket.send(JSON.stringify({ type: "CHAT", text }));
  chatInput.innerHTML = "";
}

function renderChat(msg) {
  const div = document.createElement("div");
  div.className = `message ${msg.senderId === myId ? "sent" : "received"}`;
  if (msg.text.startsWith("data:image")) {
    div.innerHTML = `<img src="${msg.text}">`;
  } else {
    div.textContent = msg.text;
  }
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}
