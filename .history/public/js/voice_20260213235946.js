// voice.js
import {
  joinVoiceBtn,
  leaveVoiceBtn,
  voiceStatusEl
} from "./dom.js";

import {
  activeChannelId,
  inVoiceChannelId,
  setVoiceChannel,
  peerPCs,
  pendingIce
} from "./state.js";;

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
  if (!activeChannelId) return;

  let stream;
  try {
    stream = await startMic();
  } catch {
    alert("Mic permission denied");
    return;
  }

  window.localStream = stream;

  setVoiceChannel(String(activeChannelId));

  socket.emit("voice:join", {
    channelId: activeChannelId
  });

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

socket.on("voice:user_joined", async ({ socketId }) => {
  let pc = peerPCs.get(socketId);
if (!pc) {
  pc = createPeerConnection(socketId);
}

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("webrtc:offer", {
    to: socketId,
    channelId: inVoiceChannelId,
    sdp: offer
  });
});

socket.on("webrtc:offer", async ({ from, sdp }) => {
  let pc = peerPCs.get(from);
  if (!pc) {
    pc = createPeerConnection(from);
  }

  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  flushPendingIce(from, pc);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("webrtc:answer", {
    to: from,
    channelId: inVoiceChannelId,
    sdp: answer
  });
});


socket.on("webrtc:answer", async ({ from, sdp }) => {
  const pc = peerPCs.get(from);
  if (!pc) return;

  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  flushPendingIce(from, pc);
});


socket.on("webrtc:ice", async ({ from, candidate }) => {
  const pc = peerPCs.get(from);
  if (!pc) return;

  if (!pc.remoteDescription) {
    if (!pendingIce.has(from)) {
      pendingIce.set(from, []);
    }
    pendingIce.get(from).push(candidate);
    return;
  }

  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("ICE add error:", err);
  }
});


socket.on("voice:user_left", ({ socketId }) => {
  const pc = peerPCs.get(socketId);
  if (pc) {
    pc.close();
    peerPCs.delete(socketId);
  }
});

function flushPendingIce(socketId, pc) {
  const candidates = pendingIce.get(socketId);
  if (!candidates) return;

  for (const candidate of candidates) {
    pc.addIceCandidate(new RTCIceCandidate(candidate))
      .catch(err => console.error("Flush ICE error:", err));
  }

  pendingIce.delete(socketId);
}






