const url = window.location.href;

if (url.includes("@") || url.includes("bit.ly")) {
  alert("⚠️ Warning: This site may be a phishing attempt!");
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkLoginForm") {

    let passwordFields = document.querySelectorAll("input[type='password']");
    let hasPassword = passwordFields.length > 0;

    sendResponse({ hasPassword: hasPassword });
  }
});

(function () {
  const url = window.location.href;

  let riskScore = 0;

  if (url.includes("@")) riskScore += 30;
  if (url.length > 75) riskScore += 15;
  if (url.includes("bit.ly") || url.includes("tinyurl")) riskScore += 25;
  if (url.includes("login") || url.includes("verify") || url.includes("bank")) riskScore += 20;
  if (!url.startsWith("https")) riskScore += 10;

  const passwordFields = document.querySelectorAll("input[type='password']");
  if (passwordFields.length > 0) riskScore += 25;

  let message = "";
  let color = "";

  if (riskScore >= 60) {
    message = "❌ Phishing Detected!";
    color = "red";
  } else if (riskScore >= 30) {
    message = "⚠️ Suspicious Website";
    color = "orange";
  } else {
    message = "✅ Safe Website";
    color = "green";
  }

  // Create banner
  const banner = document.createElement("div");
  banner.innerText = message + " (Risk Score: " + riskScore + ")";
  
  banner.style.position = "fixed";
  banner.style.top = "0";
  banner.style.left = "0";
  banner.style.width = "100%";
  banner.style.padding = "10px";
  banner.style.backgroundColor = color;
  banner.style.color = "white";
  banner.style.textAlign = "center";
  banner.style.fontWeight = "bold";
  banner.style.zIndex = "9999";

  document.body.prepend(banner);
})();