// ---- DOM ----
const channelsEl = document.getElementById("channels");
const messagesEl = document.getElementById("messages");
const channelTitleEl = document.getElementById("channelTitle");
const channelTypeEl = document.getElementById("channelType");
const meEl = document.getElementById("me");
const draftEl = document.getElementById("draft");
const sendBtn = document.getElementById("send");

const joinVoiceBtn = document.getElementById("joinVoice");
const leaveVoiceBtn = document.getElementById("leaveVoice");
const voiceStatusEl = document.getElementById("voiceStatus");

const addChannelBtn = document.getElementById("addChannel");
const channelErrorEl = document.getElementById("channelError");

// Context menu elements/state
const ctxMenu = document.getElementById("ctxMenu");
const ctxDelete = document.getElementById("ctxDelete");
let ctxChannel = null; // { id, name, type }

// Add Channel modal elements/state
const modalBackdrop = document.getElementById("modalBackdrop");
const newChannelNameEl = document.getElementById("newChannelName");
const newChannelTypeEl = document.getElementById("newChannelType");
const modalErrorEl = document.getElementById("modalError");
const cancelCreateBtn = document.getElementById("cancelCreate");
const createChannelBtn = document.getElementById("createChannelBtn");

// ---- App state ----
let activeChannelId = null;
let activeChannelType = null; // "TEXT" | "VOICE"

// ---- Voice state ----
let inVoiceChannelId = null;
let localStream = null;            // mic MediaStream
const peerPCs = new Map();         // socketId -> RTCPeerConnection

const socket = io({ withCredentials: true });

socket.on("connect", () => console.log("socket connected"));
socket.on("connect_error", (err) => console.log("socket connect_error:", err.message));

// ---- Chat realtime ----
socket.on("message:new", (payload) => {
if (Number(payload.channelId) !== Number(activeChannelId)) return;
if (activeChannelType !== "TEXT") return;
renderMessage(payload.message);
messagesEl.scrollTop = messagesEl.scrollHeight;
});

// ---- Utils ----
function escapeHtml(s) {
return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));
}

function renderMessage(m) {
const div = document.createElement("div");
div.className = "msg";
div.innerHTML =
    `<b>${escapeHtml(m.username)}</b>` +
    `<span class="meta">${new Date(m.created_at).toLocaleString()}</span>` +
    `<div>${escapeHtml(m.content)}</div>`;
messagesEl.appendChild(div);
}

async function requireMe() {
const res = await fetch("/auth/me", { credentials: "include" });
if (!res.ok) {
    location.href = "/login.html";
    return;
}
const data = await res.json();
meEl.innerHTML = `<b>Logged in:</b> ${escapeHtml(data.user.username)}`;
}

// ---- Context menu helpers ----
function hideCtxMenu() {
ctxMenu.style.display = "none";
ctxChannel = null;
}

function showCtxMenu(x, y, channel) {
ctxChannel = channel;

const menuW = 170;
const menuH = 60;
const px = Math.min(x, window.innerWidth - menuW - 8);
const py = Math.min(y, window.innerHeight - menuH - 8);

ctxMenu.style.left = px + "px";
ctxMenu.style.top = py + "px";
ctxMenu.style.display = "block";
}

document.addEventListener("click", () => hideCtxMenu());
document.addEventListener("keydown", (e) => {
if (e.key === "Escape") { hideCtxMenu(); hideModal(); }
});
window.addEventListener("resize", hideCtxMenu);
window.addEventListener("scroll", hideCtxMenu);

// ---- Modal helpers ----
function showModal() {
modalErrorEl.textContent = "";
newChannelNameEl.value = "";
newChannelTypeEl.value = "TEXT";
modalBackdrop.style.display = "block";
newChannelNameEl.focus();
}

function hideModal() {
modalBackdrop.style.display = "none";
}

modalBackdrop.addEventListener("click", (e) => {
if (e.target === modalBackdrop) hideModal();
});

cancelCreateBtn.onclick = hideModal;

// ---- Channels ----
async function loadChannels() {
const res = await fetch("/channels", { credentials: "include" });
if (!res.ok) return;

const data = await res.json();
channelsEl.innerHTML = "";

const textHeader = document.createElement("div");
textHeader.className = "sectionHeader";
textHeader.innerHTML = "<b>Text</b>";
channelsEl.appendChild(textHeader);

data.channels.filter(c => c.type === "TEXT").forEach((ch) => {
    const btn = document.createElement("button");
    btn.className = "chan";
    btn.textContent = "# " + ch.name;
    btn.dataset.id = ch.id;
    btn.dataset.type = ch.type;

    btn.onclick = () => openChannel(ch.id, ch.name, ch.type);

    btn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showCtxMenu(e.clientX, e.clientY, { id: ch.id, name: ch.name, type: ch.type });
    });

    channelsEl.appendChild(btn);
});

const voiceHeader = document.createElement("div");
voiceHeader.className = "sectionHeader";
voiceHeader.innerHTML = "<b>Voice</b>";
voiceHeader.style.marginTop = "12px";
channelsEl.appendChild(voiceHeader);

data.channels.filter(c => c.type === "VOICE").forEach((ch) => {
    const btn = document.createElement("button");
    btn.className = "chan";
    btn.textContent = "🔊 " + ch.name;
    btn.dataset.id = ch.id;
    btn.dataset.type = ch.type;

    btn.onclick = () => openChannel(ch.id, ch.name, ch.type);

    btn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showCtxMenu(e.clientX, e.clientY, { id: ch.id, name: ch.name, type: ch.type });
    });

    channelsEl.appendChild(btn);
});

// keep highlight
if (activeChannelId !== null) {
    document.querySelectorAll(".chan").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.id) === Number(activeChannelId));
    });
}
}

async function openChannel(id, name, type) {
activeChannelId = Number(id);
activeChannelType = type;

channelTitleEl.textContent = (type === "VOICE" ? "🔊 " : "# ") + name;
channelTypeEl.textContent = type === "VOICE" ? "(Voice)" : "(Text)";

document.querySelectorAll(".chan").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.id) === activeChannelId);
});

messagesEl.innerHTML = "";

// ---- Voice buttons ----
if (type === "VOICE") {
    joinVoiceBtn.disabled = !!inVoiceChannelId;
} else {
    joinVoiceBtn.disabled = true;
}

// If switching away from the voice channel you're in, auto-leave
if (inVoiceChannelId && String(activeChannelId) !== String(inVoiceChannelId)) {
    socket.emit("voice:leave", { channelId: inVoiceChannelId });
    closeAllPeers();
    stopMic();
    inVoiceChannelId = null;
    leaveVoiceBtn.disabled = true;
    setVoiceStatus("");
}

const isText = type === "TEXT";
draftEl.disabled = !isText;
sendBtn.disabled = !isText;

if (!isText) {
    messagesEl.innerHTML = "<i>This is a voice channel. Click Join Voice to talk.</i>";
    return;
}

socket.emit("channel:join", { channelId: activeChannelId });

const res = await fetch(`/channels/${id}/messages?limit=50`, { credentials: "include" });
if (!res.ok) {
    messagesEl.innerHTML = "<i>Failed to load messages</i>";
    return;
}

const data = await res.json();
data.messages.forEach(renderMessage);
messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---- Sending chat messages ----
function sendMessage() {
const text = draftEl.value;
if (!activeChannelId) return;
if (activeChannelType !== "TEXT") return;
if (!text.trim()) return;

socket.emit("message:send", { channelId: activeChannelId, content: text });

draftEl.value = "";
draftEl.focus();
}

sendBtn.onclick = sendMessage;
draftEl.addEventListener("keydown", (e) => {
if (e.key === "Enter") sendMessage();
});

// ---- Logout ----
document.getElementById("logout").onclick = async () => {
await fetch("/auth/logout", { method: "POST", credentials: "include" });
location.href = "/login.html";
};

// ---- Create channel (modal) ----
addChannelBtn.onclick = () => {
channelErrorEl.textContent = "";
showModal();
};

async function createChannel() {
modalErrorEl.textContent = "";

const name = newChannelNameEl.value;
const type = newChannelTypeEl.value; // "TEXT" or "VOICE"

const res = await fetch("/channels", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, type })
});

const txt = await res.text();
let data;
try { data = JSON.parse(txt); } catch { data = { error: txt }; }

if (!res.ok) {
    modalErrorEl.textContent = data.error || "Failed to create channel";
    return;
}

hideModal();
await loadChannels();
if (data.channel?.id) openChannel(data.channel.id, data.channel.name, data.channel.type);
}

createChannelBtn.onclick = createChannel;
newChannelNameEl.addEventListener("keydown", (e) => {
if (e.key === "Enter") createChannel();
});

// ---- Delete (context menu) ----
ctxDelete.onclick = async (e) => {
e.stopPropagation();
if (!ctxChannel) return;

const id = ctxChannel.id;
const name = ctxChannel.name;

if (!confirm(`Delete ${ctxChannel.type === "VOICE" ? "🔊 " : "# "}${name}? This deletes all messages in it.`)) {
    hideCtxMenu();
    return;
}

const res = await fetch(`/channels/${id}`, { method: "DELETE", credentials: "include" });

const txt = await res.text();
let data;
try { data = JSON.parse(txt); } catch { data = { error: txt }; }

hideCtxMenu();

if (!res.ok) {
    alert(data.error || "Failed to delete channel");
    return;
}

if (Number(activeChannelId) === Number(id)) {
    activeChannelId = null;
    activeChannelType = null;
    channelTitleEl.textContent = "Pick a channel";
    channelTypeEl.textContent = "";
    messagesEl.innerHTML = "";
    draftEl.disabled = true;
    sendBtn.disabled = true;
    joinVoiceBtn.disabled = true;
}

await loadChannels();

if (!activeChannelId) {
    const firstText = Array.from(document.querySelectorAll(".chan")).find((b) => b.dataset.type === "TEXT");
    const firstAny = document.querySelector(".chan");
    if (firstText) firstText.click();
    else if (firstAny) firstAny.click();
}
};

// ---- Voice: WebRTC helpers ----
function setVoiceStatus(t) { voiceStatusEl.textContent = t || ""; }

async function startMic() {
localStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
});
}

function stopMic() {
if (!localStream) return;
localStream.getTracks().forEach(t => t.stop());
localStream = null;
}

function removeRemoteAudio(peerSocketId) {
const el = document.getElementById("a_" + peerSocketId);
if (el) el.remove();
}

function closePeer(peerSocketId) {
const pc = peerPCs.get(peerSocketId);
if (pc) {
    try { pc.close(); } catch {}
    peerPCs.delete(peerSocketId);
}
removeRemoteAudio(peerSocketId);
}

function closeAllPeers() {
for (const sid of Array.from(peerPCs.keys())) closePeer(sid);
}

function makePC(peerSocketId) {
const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

pc.onicecandidate = (e) => {
    if (e.candidate && inVoiceChannelId) {
    socket.emit("webrtc:ice", { to: peerSocketId, channelId: inVoiceChannelId, candidate: e.candidate });
    }
};

pc.ontrack = (e) => {
    const stream = e.streams[0];
    let audio = document.getElementById("a_" + peerSocketId);
    if (!audio) {
    audio = document.createElement("audio");
    audio.id = "a_" + peerSocketId;
    audio.autoplay = true;
    audio.playsInline = true;
    document.body.appendChild(audio);
    }
    audio.srcObject = stream;
};

if (localStream) {
    for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
    }
}

return pc;
}

// ---- Voice: signaling ----
socket.on("voice:peers", async ({ channelId, peers }) => {
if (String(channelId) !== String(inVoiceChannelId)) return;

for (const p of peers) {
    const peerSocketId = p.socketId;
    if (peerPCs.has(peerSocketId)) continue;

    const pc = makePC(peerSocketId);
    peerPCs.set(peerSocketId, pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("webrtc:offer", { to: peerSocketId, channelId, sdp: offer });
}
});

socket.on("voice:user_left", ({ channelId, socketId }) => {
if (String(channelId) !== String(inVoiceChannelId)) return;
closePeer(socketId);
});

socket.on("webrtc:offer", async ({ from, channelId, sdp }) => {
if (String(channelId) !== String(inVoiceChannelId)) return;

let pc = peerPCs.get(from);
if (!pc) {
    pc = makePC(from);
    peerPCs.set(from, pc);
}

await pc.setRemoteDescription(new RTCSessionDescription(sdp));
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);

socket.emit("webrtc:answer", { to: from, channelId, sdp: answer });
});

socket.on("webrtc:answer", async ({ from, channelId, sdp }) => {
if (String(channelId) !== String(inVoiceChannelId)) return;
const pc = peerPCs.get(from);
if (!pc) return;
await pc.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on("webrtc:ice", async ({ from, channelId, candidate }) => {
if (String(channelId) !== String(inVoiceChannelId)) return;
const pc = peerPCs.get(from);
if (!pc) return;
try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
} catch (e) {
    console.log("ICE add failed:", e);
}
});

// ---- Voice: join/leave buttons ----
joinVoiceBtn.onclick = async () => {
if (activeChannelType !== "VOICE") return;
if (inVoiceChannelId) return;

try {
    await startMic();
} catch {
    alert("Mic permission denied (or no mic).");
    return;
}

inVoiceChannelId = String(activeChannelId);
socket.emit("voice:join", { channelId: inVoiceChannelId });

joinVoiceBtn.disabled = true;
leaveVoiceBtn.disabled = false;
setVoiceStatus("Connected (voice)");
};

leaveVoiceBtn.onclick = async () => {
if (!inVoiceChannelId) return;

socket.emit("voice:leave", { channelId: inVoiceChannelId });

closeAllPeers();
stopMic();

inVoiceChannelId = null;
joinVoiceBtn.disabled = (activeChannelType !== "VOICE");
leaveVoiceBtn.disabled = true;
setVoiceStatus("");
};

// ---- Boot ----
(async () => {
await requireMe();
await loadChannels();

const firstText = Array.from(document.querySelectorAll(".chan")).find((b) => b.dataset.type === "TEXT");
const firstAny = document.querySelector(".chan");
if (firstText) firstText.click();
else if (firstAny) firstAny.click();
})();