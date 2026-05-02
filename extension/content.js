const BANNER_ID = "phishdetector-auto-banner";
let bannerDismissed = false;

function upsertBanner(level, title, message) {
  if (bannerDismissed) {
    return;
  }

  let banner = document.getElementById(BANNER_ID);
  if (!banner) {
    banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.style.position = "fixed";
    banner.style.top = "0";
    banner.style.left = "0";
    banner.style.width = "100%";
    banner.style.padding = "10px 14px";
    banner.style.fontFamily = "Arial, sans-serif";
    banner.style.fontSize = "14px";
    banner.style.fontWeight = "bold";
    banner.style.color = "#ffffff";
    banner.style.textAlign = "center";
    banner.style.zIndex = "2147483647";
    banner.style.boxShadow = "0 2px 6px rgba(0,0,0,0.35)";
    banner.style.display = "flex";
    banner.style.alignItems = "center";
    banner.style.justifyContent = "space-between";
    banner.style.gap = "8px";

    const text = document.createElement("span");
    text.id = `${BANNER_ID}-text`;
    text.style.flex = "1";
    text.style.textAlign = "left";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.style.border = "none";
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "#ffffff";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "20px";
    closeBtn.style.lineHeight = "1";
    closeBtn.style.fontWeight = "bold";
    closeBtn.setAttribute("aria-label", "Close PhishDetector banner");
    closeBtn.addEventListener("click", () => {
      bannerDismissed = true;
      banner.remove();
    });

    banner.appendChild(text);
    banner.appendChild(closeBtn);
    document.documentElement.appendChild(banner);
  }

  const bgByLevel = {
    safe: "#15803d",
    suspicious: "#b45309",
    danger: "#b91c1c",
    error: "#334155"
  };
  banner.style.background = bgByLevel[level] || bgByLevel.error;
  const textNode = document.getElementById(`${BANNER_ID}-text`);
  if (textNode) {
    textNode.textContent = `${title} - ${message}`;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "collectSignals") {
    const hasPassword = document.querySelectorAll("input[type='password']").length > 0;
    const hasEmailForm = document.querySelectorAll("form[action^='mailto:']").length > 0;
    const hasIframe = document.querySelectorAll("iframe").length > 0;
    const hasPopupWindow =
      document.querySelectorAll("[onclick*='window.open']").length > 0 ||
      document.querySelectorAll("a[target='_blank']").length > 0;
    const hasOnMouseOver = document.querySelectorAll("[onmouseover]").length > 0;
    const disablesRightClick =
      document.querySelectorAll("[oncontextmenu]").length > 0 ||
      document.body?.getAttribute("oncontextmenu") !== null;
    const redirectCount = performance.getEntriesByType("navigation")[0]?.redirectCount || 0;

    sendResponse({
      hasPassword,
      hasEmailForm,
      hasIframe,
      hasPopupWindow,
      hasOnMouseOver,
      disablesRightClick,
      redirectCount
    });
    return;
  }

  if (request.action === "showAutoScanBanner") {
    upsertBanner(request.level, request.title, request.message);
    sendResponse({ ok: true });
  }
});