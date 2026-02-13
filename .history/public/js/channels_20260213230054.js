// channels.js
import {
  channelsEl,
  channelTitleEl,
  channelTypeEl,
  messagesEl,
  draftEl,
  sendBtn
} from "./dom.js";

import { socket } from "./socket.js";
import { renderMessage } from "./utils.js";
import { setActiveChannel } from "./state.js";

export async function loadChannels() {
  const res = await fetch("/channels", { credentials: "include" });
  if (!res.ok) return;

  const { channels } = await res.json();
  channelsEl.innerHTML = "";

  renderChannelSection("Text", "TEXT", "#");
  renderChannelSection("Voice", "VOICE", "🔊");

  function renderChannelSection(label, type, icon) {
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
  setActiveChannel(Number(ch.id), ch.type);

  channelTitleEl.textContent = `${ch.type === "VOICE" ? "🔊" : "#"} ${ch.name}`;
  channelTypeEl.textContent = `(${ch.type})`;
  messagesEl.innerHTML = "";

  const isText = ch.type === "TEXT";
  draftEl.disabled = !isText;
  sendBtn.disabled = !isText;

  if (!isText) {
    messagesEl.innerHTML = "<i>This is a voice channel.</i>";
    return;
  }

  socket.emit("channel:join", { channelId: ch.id });

  const res = await fetch(`/channels/${ch.id}/messages?limit=50`, {
    credentials: "include"
  });

  const data = await res.json();
  data.messages.forEach(renderMessage);
}
