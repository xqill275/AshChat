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

socket.on("dice:result", payload => {
  if (Number(payload.channelId) !== Number(activeChannelId)) return;

  const div = document.createElement("div");
  div.className = "msg dice";

  div.innerHTML = `
    <b>${payload.username}</b>
    <span class="meta">${new Date(payload.created_at).toLocaleString()}</span>
    <div>
      🎲 Rolled ${payload.expression} → <b>${payload.total}</b>
      <small>(${payload.rolls.join(", ")}${payload.modifier ? 
        (payload.modifier > 0 ? " + " + payload.modifier : " - " + Math.abs(payload.modifier))
        : ""})</small>
    </div>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
});


