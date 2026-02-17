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

  const text = draftEl.value.trim();
  if (!text) return;

  // Dice command
  if (text.startsWith("/roll ")) {
    const expression = text.slice(6).trim();

    socket.emit("dice:roll", {
      channelId: activeChannelId,
      expression
    });

    draftEl.value = "";
    return;
  }

  // Normal message
  socket.emit("message:send", {
    channelId: activeChannelId,
    content: text
  });

  draftEl.value = "";
}
