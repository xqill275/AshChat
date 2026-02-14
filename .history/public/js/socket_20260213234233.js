//socket.js
import { renderMessage } from "./utils.js";
import { activeChannelId, activeChannelType } from "./state.js";
import { messagesEl } from "./dom.js";

export const socket = io({ withCredentials: true });

socket.on("connect", () => console.log("socket connected"));
socket.on("connect_error", err => console.log("socket error:", err.message));

socket.on("message:new", payload => {
  if (Number(payload.channelId) !== Number(activeChannelId)) return;
  if (activeChannelType !== "TEXT") return;

  renderMessage(payload.message);
  messagesEl.scrollTop = messagesEl.scrollHeight;
});
