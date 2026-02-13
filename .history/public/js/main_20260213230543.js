// main.js
import { meEl } from "./dom.js";
import { loadChannels } from "./channels.js";
import { initMessaging } from "./messages.js";
import { initModal } from "./modal.js";
import { initVoice } from "./voice.js";

async function requireMe() {
  const res = await fetch("/auth/me", { credentials: "include" });
  if (!res.ok) {
    location.href = "/login.html";
    return;
  }
  const data = await res.json();
  meEl.innerHTML = `<b>Logged in:</b> ${data.user.username}`;
}

(async () => {
  await requireMe();
  await loadChannels();
  initMessaging();
  initModal();
  initVoice();
})();
