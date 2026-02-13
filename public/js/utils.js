import { messagesEl } from "./dom.js";

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[c]));
}

export function renderMessage(m) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `
    <b>${escapeHtml(m.username)}</b>
    <span class="meta">${new Date(m.created_at).toLocaleString()}</span>
    <div>${escapeHtml(m.content)}</div>
  `;
  messagesEl.appendChild(div);
}
