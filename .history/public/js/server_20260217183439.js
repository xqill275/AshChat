import { setActiveServer } from "./state.js";
import { loadChannels } from "./channels.js";

export async function loadServers() {
  const res = await fetch("/servers", { credentials: "include" });
  if (!res.ok) return;

  const { servers } = await res.json();

  const sidebar = document.getElementById("servers");
  sidebar.innerHTML = "";

  servers.forEach(s => {
    const btn = document.createElement("button");
    btn.textContent = s.name;
    btn.onclick = async () => {
      setActiveServer(s.id);
      await loadChannels();
    };
    sidebar.appendChild(btn);
  });

  // Auto-select first server
  if (servers.length) {
    setActiveServer(servers[0].id);
    await loadChannels();
  }
}
