// modal.js
import {
  modalBackdrop,
  newChannelNameEl,
  newChannelTypeEl,
  modalErrorEl,
  cancelCreateBtn,
  createChannelBtn,
  addChannelBtn,
  logoutBtn,
  createServerBtn
} from "./dom.js";

import { loadChannels } from "./channels.js";

import { getActiveServer } from "./state.js";

import { createServer } from "./servers.js";

export function initModal() {
  addChannelBtn.onclick = showModal;
  cancelCreateBtn.onclick = hideModal;
  createChannelBtn.onclick = createChannel;
  createServerBtn.onclick
  logoutBtn.onclick = logout;

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
  const serverId = getActiveServer();
  const name = newChannelNameEl.value;
  const type = newChannelTypeEl.value;

  const res = await fetch("/channels", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, type, serverId })
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

function logout() {
  fetch("/auth/logout", {
    method: "POST",
    credentials: "include"
  }).then(() => {
    location.href = "/login.html";
  })};
}
  
  export async function createServer(name) {
    const res = await fetch("/servers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      alert("Failed to create server");
      return null;
    }

    const server = await res.json();
    return server;


