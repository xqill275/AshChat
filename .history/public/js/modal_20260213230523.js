// modal.js
import {
  modalBackdrop,
  newChannelNameEl,
  newChannelTypeEl,
  modalErrorEl,
  cancelCreateBtn,
  createChannelBtn,
  addChannelBtn
} from "./dom.js";

import { loadChannels } from "./channels.js";

export function initModal() {
  addChannelBtn.onclick = showModal;
  cancelCreateBtn.onclick = hideModal;
  createChannelBtn.onclick = createChannel;

  modalBackdrop.addEventListener("click", e => {
    if (e.target === modalBackdrop) hideModal();
  });
}

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

async function createChannel() {
  modalErrorEl.textContent = "";

  const name = newChannelNameEl.value;
  const type = newChannelTypeEl.value;

  const res = await fetch("/channels", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, type })
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { data = { error: text }; }

  if (!res.ok) {
    modalErrorEl.textContent = data.error || "Failed to create channel";
    return;
  }

  hideModal();
  await loadChannels();
}
