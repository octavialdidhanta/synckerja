const DEFAULT_BASE = "https://office.synckerja.com";

async function load() {
  const stored = await chrome.storage.sync.get(["baseUrl", "interestIds"]);
  document.getElementById("baseUrl").value = stored.baseUrl || DEFAULT_BASE;
  document.getElementById("ids").value = (stored.interestIds || []).join("\n");
}

document.getElementById("openBtn").addEventListener("click", async () => {
  const baseUrl = (document.getElementById("baseUrl").value || DEFAULT_BASE).replace(/\/$/, "");
  const ids = document
    .getElementById("ids")
    .value.split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  await chrome.storage.sync.set({ baseUrl, interestIds: ids });
  const url = `${baseUrl}/digital-marketing/meta-ads/interest-research${
    ids.length ? `?ids=${encodeURIComponent(ids.join(","))}` : ""
  }`;
  chrome.tabs.create({ url });
});

document.getElementById("captureBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const res = await chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_INTEREST_IDS" }).catch(() => null);
  if (res?.ids?.length) {
    document.getElementById("ids").value = res.ids.join("\n");
    await chrome.storage.sync.set({ interestIds: res.ids });
  }
});

load();
