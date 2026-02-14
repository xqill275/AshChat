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

function createPeerConnection(socketId) {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

  peerPCs.set(socketId, pc);

  // send ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("webrtc:ice", {
        to: socketId,
        channelId: inVoiceChannelId,
        candidate: event.candidate
      });
    }
  };

  // receive audio
  pc.ontrack = (event) => {
    const audio = document.createElement("audio");
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
  };

  // add local mic stream
  window.localStream.getTracks().forEach(track => {
    pc.addTrack(track, window.localStream);
  });

  return pc;
}

socket.on("voice:peers", async ({ peers }) => {
  for (const peer of peers) {
    const pc = createPeerConnection(peer.socketId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("webrtc:offer", {
      to: peer.socketId,
      channelId: inVoiceChannelId,
      sdp: offer
    });
  }
});

