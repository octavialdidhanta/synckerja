function captureInterestIds() {
  const text = document.body?.innerText || "";
  const matches = text.match(/\b\d{10,20}\b/g) || [];
  const unique = [...new Set(matches)].slice(0, 50);
  return unique;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "CAPTURE_INTEREST_IDS") {
    sendResponse({ ids: captureInterestIds() });
    return true;
  }
  return false;
});
