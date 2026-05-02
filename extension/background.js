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

function isScannableUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function getAutoScanEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get([AUTO_SCAN_KEY], (items) => {
      const enabled = items[AUTO_SCAN_KEY];
      resolve(enabled !== false);
    });
  });
}

async function ensureContentScriptAndGetSignals(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: "collectSignals" });
    return response || DEFAULT_SIGNALS;
  } catch (_error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
      const response = await chrome.tabs.sendMessage(tabId, { action: "collectSignals" });
      return response || DEFAULT_SIGNALS;
    } catch (_secondError) {
      return DEFAULT_SIGNALS;
    }
  }
}

async function pushBanner(tabId, payload) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "showAutoScanBanner", ...payload });
  } catch (_error) {
    // Ignore failures on protected pages.
  }
}

async function analyzeTab(tabId, url) {
  const autoScanEnabled = await getAutoScanEnabled();
  if (!autoScanEnabled) {
    return;
  }

  if (!isScannableUrl(url)) {
    return;
  }

  const pageSignals = await ensureContentScriptAndGetSignals(tabId);

  try {
    const response = await fetch(ANALYZE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, pageSignals })
    });
    const data = await response.json();

    if (!response.ok) {
      await pushBanner(tabId, {
        level: "error",
        title: "PhishDetector",
        message: data.error || "Scan failed"
      });
      return;
    }

    const score = Number(data.score || 0);
    const level = score >= 60 ? "danger" : score >= 35 ? "suspicious" : "safe";
    await pushBanner(tabId, {
      level,
      title: data.result || "Scan Complete",
      message: `Risk score: ${score}/100`
    });
  } catch (_error) {
    await pushBanner(tabId, {
      level: "error",
      title: "PhishDetector",
      message: "Backend unreachable"
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ [AUTO_SCAN_KEY]: true });
  console.log("PhishDetector installed");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab?.url) {
    analyzeTab(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.url) {
      analyzeTab(tabId, tab.url);
    }
  } catch (_error) {
    // Ignore invalid tab states.
  }
});