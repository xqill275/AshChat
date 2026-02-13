// messages.js
import { draftEl, sendBtn } from "./dom.js";
import { socket } from "./socket.js";
import { activeChannelId, activeChannelType } from "./state.js";

export function initMessaging() {
  sendBtn.onclick = sendMessage;

  draftEl.addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
  });
}

function sendMessage() {
  if (!activeChannelId) return;
  if (activeChannelType !== "TEXT") return;
  if (!draftEl.value.trim()) return;

  socket.emit("message:send", {
    channelId: activeChannelId,
    content: draftEl.value
  });

  draftEl.value = "";
  draftEl.focus();
}
