// state.js
export let activeChannelId = null;
export let activeChannelType = null;

export let inVoiceChannelId = null;
export let localStream = null;

export const peerPCs = new Map();

export const pendingIce = new Map();

export function setActiveChannel(id, type) {
  activeChannelId = id;
  activeChannelType = type;
}

export function setVoiceChannel(id) {
  inVoiceChannelId = id;
}
