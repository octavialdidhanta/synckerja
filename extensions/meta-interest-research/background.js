chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["baseUrl"], (stored) => {
    if (!stored.baseUrl) {
      chrome.storage.sync.set({ baseUrl: "https://office.synckerja.com" });
    }
  });
});
