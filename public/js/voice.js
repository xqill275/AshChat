// voice.js
import {
  joinVoiceBtn,
  leaveVoiceBtn,
  voiceStatusEl
} from "./dom.js";

import {
  inVoiceChannelId,
  setVoiceChannel,
  peerPCs,
  localStream
} from "./state.js";

import { socket } from "./socket.js";

export function initVoice() {
  joinVoiceBtn.onclick = joinVoice;
  leaveVoiceBtn.onclick = leaveVoiceInternal;
}

function setVoiceStatus(t) {
  voiceStatusEl.textContent = t || "";
}

async function startMic() {
  return await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  });
}

function stopMic() {
  if (!localStream) return;
  localStream.getTracks().forEach(t => t.stop());
}

export async function joinVoice() {
  if (inVoiceChannelId) return;

  try {
    window.localStream = await startMic();
  } catch {
    alert("Mic permission denied");
    return;
  }

  setVoiceChannel(String(window.activeChannelId));
  socket.emit("voice:join", { channelId: inVoiceChannelId });

  joinVoiceBtn.disabled = true;
  leaveVoiceBtn.disabled = false;
  setVoiceStatus("Connected (voice)");
}

export function leaveVoiceInternal() {
  if (!inVoiceChannelId) return;

  socket.emit("voice:leave", { channelId: inVoiceChannelId });

  for (const pc of peerPCs.values()) {
    try { pc.close(); } catch {}
  }
  peerPCs.clear();

  stopMic();
  setVoiceChannel(null);

  joinVoiceBtn.disabled = false;
  leaveVoiceBtn.disabled = true;
  setVoiceStatus("");
}
