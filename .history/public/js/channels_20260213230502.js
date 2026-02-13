// channels.js
import {
  channelsEl,
  channelTitleEl,
  channelTypeEl,
  messagesEl,
  draftEl,
  sendBtn,
  joinVoiceBtn,
  leaveVoiceBtn
} from "./dom.js";

import { socket } from "./socket.js";
import { renderMessage } from "./utils.js";
import {
  setActiveChannel,
  activeChannelId,
  inVoiceChannelId
} from "./state.js";

import { leaveVoiceInternal } from "./voice.js";

export async function loadChannels() {
  const res = await fetch("/channels", { credentials: "include" });
  if (!res.ok) return;

  const { channels } = await res.json();
  channelsEl.innerHTML = "";

  renderSection("Text", "TEXT", "#");
  renderSection("Voice", "VOICE", "🔊");

  function renderSection(label, type, icon) {
    const header = document.createElement("div");
    header.className = "sectionHeader";
    header.innerHTML = `<b>${label}</b>`;
    channelsEl.appendChild(header);

    channels.filter(c => c.type === type).forEach(ch => {
      const btn = document.createElement("button");
      btn.className = "chan";
      btn.textContent = `${icon} ${ch.name}`;
      btn.onclick = () => openChannel(ch);
      channelsEl.appendChild(btn);
    });
  }
}

export async function openChannel(ch) {
  if (inVoiceChannelId && String(ch.id) !== String(inVoiceChannelId)) {
    leaveVoiceInternal();
  }

  setActiveChannel(Number(ch.id), ch.type);

  channelTitleEl.textContent =
    `${ch.type === "VOICE" ? "🔊" : "#"} ${ch.name}`;
  channelTypeEl.textContent = `(${ch.type})`;

  document.querySelectorAll(".chan").forEach(b => {
    b.classList.toggle(
      "active",
      b.textContent.includes(ch.name)
    );
  });

  messagesEl.innerHTML = "";

  const isText = ch.type === "TEXT";
  draftEl.disabled = !isText;
  sendBtn.disabled = !isText;
  joinVoiceBtn.disabled = ch.type !== "VOICE";

  if (!isText) {
    messagesEl.innerHTML =
      "<i>This is a voice channel. Click Join Voice to talk.</i>";
    return;
  }

  socket.emit("channel:join", { channelId: ch.id });

  const res = await fetch(`/channels/${ch.id}/messages?limit=50`, {
    credentials: "include"
  });

  if (!res.ok) {
    messagesEl.innerHTML = "<i>Failed to load messages</i>";
    return;
  }

  const data = await res.json();
  data.messages.forEach(renderMessage);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
