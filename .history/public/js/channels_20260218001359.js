// channels.js
import {
  channelsEl,
  channelTitleEl,
  channelTypeEl,
  messagesEl,
  draftEl,
  sendBtn,
  joinVoiceBtn,
  leaveVoiceBtn,
  ctxMenu,
  ctxDelete
} from "./dom.js";

import { socket } from "./socket.js";
import { renderMessage } from "./utils.js";
import {
  setActiveChannel,
  activeChannelId,
  inVoiceChannelId,
  getActiveServer
} from "./state.js";

import { leaveVoiceInternal } from "./voice.js";

let contextChannel = null;

/* =========================
   LOAD CHANNELS
========================= */

export async function loadChannels() {
  const serverId = getActiveServer();

  if (!serverId) {
    console.log("No active server selected");
    return;
  }

  const res = await fetch(`/channels?serverId=${serverId}`, {
    credentials: "include"
  });

  if (!res.ok) {
    console.error("Failed to load channels");
    return;
  }

  const { channels } = await res.json();
  channelsEl.innerHTML = "";

  renderSection("Text Channels", "TEXT", "#");
  renderSection("Voice Chambers", "VOICE", "🔊");

  function renderSection(label, type, icon) {
    const header = document.createElement("div");
    header.className = "sectionHeader";
    header.innerHTML = `<b>${label}</b>`;
    channelsEl.appendChild(header);

    channels
      .filter(c => c.type === type)
      .forEach(ch => {
        const btn = document.createElement("button");
        btn.className = "chan";
        btn.dataset.channelId = ch.id;
        btn.dataset.channelType = ch.type;
        btn.innerHTML = `<span style="opacity:.7">${icon}</span> ${ch.name}`;

        btn.onclick = () => openChannel(ch);

        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          contextChannel = ch;

          ctxMenu.style.display = "block";
          ctxMenu.style.left = e.pageX + "px";
          ctxMenu.style.top = e.pageY + "px";
        });

        channelsEl.appendChild(btn);
      });
  }
}

/* =========================
   OPEN CHANNEL
========================= */

export async function openChannel(ch) {
  // Leave voice if switching
  if (inVoiceChannelId && String(ch.id) !== String(inVoiceChannelId)) {
    leaveVoiceInternal();
  }

  setActiveChannel(Number(ch.id), ch.type);

  // Update header
  channelTitleEl.textContent =
    `${ch.type === "VOICE" ? "🔊" : "#"} ${ch.name}`;
  channelTypeEl.textContent = `(${ch.type})`;

  // Highlight active
  document.querySelectorAll(".chan").forEach(btn => {
    btn.classList.toggle(
      "active",
      String(btn.dataset.channelId) === String(ch.id)
    );
  });

  // Smooth fade effect
  messagesEl.style.opacity = "0";
  messagesEl.innerHTML = "";

  const isText = ch.type === "TEXT";
  draftEl.disabled = !isText;
  sendBtn.disabled = !isText;
  joinVoiceBtn.disabled = ch.type !== "VOICE";

  if (!isText) {
    messagesEl.innerHTML =
      "<i>This is a voice chamber. Join to speak with others.</i>";

    requestAnimationFrame(() => {
      messagesEl.style.opacity = "1";
    });

    return;
  }

  socket.emit("channel:join", { channelId: ch.id });

  const res = await fetch(
    `/channels/${ch.id}/messages?limit=50`,
    { credentials: "include" }
  );

  if (!res.ok) {
    messagesEl.innerHTML = "<i>Failed to load messages</i>";
    messagesEl.style.opacity = "1";
    return;
  }

  const data = await res.json();
  data.messages.forEach(renderMessage);

  requestAnimationFrame(() => {
    messagesEl.style.opacity = "1";
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

/* =========================
   DELETE CHANNEL
========================= */

ctxDelete.onclick = async () => {
  if (!contextChannel) return;

  const confirmed = confirm(
    `Delete channel "${contextChannel.name}"?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  const res = await fetch(`/channels/${contextChannel.id}`, {
    method: "DELETE",
    credentials: "include"
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Failed to delete channel");
    return;
  }

  ctxMenu.style.display = "none";
  contextChannel = null;

  await loadChannels();
};

/* =========================
   CLOSE CONTEXT MENU
========================= */

document.addEventListener("click", () => {
  ctxMenu.style.display = "none";
});
