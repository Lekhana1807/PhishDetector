const ANALYZE_URL = "http://127.0.0.1:5000/analyze-url";
const AUTO_SCAN_KEY = "autoScanEnabled";

const DEFAULT_SIGNALS = {
  hasPassword: false,
  hasEmailForm: false,
  hasIframe: false,
  hasPopupWindow: false,
  hasOnMouseOver: false,
  disablesRightClick: false,
  redirectCount: 0
};

async function getPageSignals(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { action: "collectSignals" });
  } catch (_error) {
    // Inject script in case content script was not ready yet.
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
      return await chrome.tabs.sendMessage(tabId, { action: "collectSignals" });
    } catch (_secondError) {
      return DEFAULT_SIGNALS;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const scanBtn = document.getElementById("scanBtn");
  const urlEl = document.getElementById("url");
  const autoScanToggle = document.getElementById("autoScanToggle");
  const resultBox = document.getElementById("resultBox");
  const statusEl = document.getElementById("status");
  const detailsEl = document.getElementById("details");

  chrome.storage.local.get([AUTO_SCAN_KEY], (items) => {
    const enabled = items[AUTO_SCAN_KEY];
    autoScanToggle.checked = enabled !== false;
  });

  autoScanToggle.addEventListener("change", () => {
    chrome.storage.local.set({ [AUTO_SCAN_KEY]: autoScanToggle.checked });
  });

  scanBtn.addEventListener("click", async () => {
    resultBox.className = "";
    resultBox.classList.remove("hidden");
    statusEl.textContent = "Scanning...";
    detailsEl.textContent = "Collecting features...";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) {
      statusEl.textContent = "Cannot scan this page";
      detailsEl.textContent = "Open a normal website tab (http/https) and try again.";
      resultBox.classList.add("danger");
      return;
    }

    urlEl.textContent = tab.url;
    const pageSignals = await getPageSignals(tab.id);

    try {
      const response = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: tab.url, pageSignals })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Backend request failed");
      }

      const score = Number(data.score || 0);
      const level = score >= 60 ? "danger" : score >= 35 ? "suspicious" : "safe";
      resultBox.classList.add(level);
      statusEl.textContent = data.result || "Scan complete";
      detailsEl.textContent = `Risk Score: ${score}/100 | Features used: ${data.used_feature_count}`;
    } catch (error) {
      resultBox.classList.add("danger");
      statusEl.textContent = "Scan failed";
      detailsEl.textContent = `Backend error: ${error.message}`;
    }
  });
});