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
  const pc = createPeerConnection(socketId);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("webrtc:offer", {
    to: socketId,
    channelId: inVoiceChannelId,
    sdp: offer
  });
});

socket.on("webrtc:offer", async ({ from, sdp }) => {
  const pc = createPeerConnection(from);

  await pc.setRemoteDescription(new RTCSessionDescription(sdp));

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
});

socket.on("webrtc:ice", async ({ from, candidate }) => {
  const pc = peerPCs.get(from);
  if (!pc) return;

  await pc.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("voice:user_left", ({ socketId }) => {
  const pc = peerPCs.get(socketId);
  if (pc) {
    pc.close();
    peerPCs.delete(socketId);
  }
});