
document.addEventListener("DOMContentLoaded", function () {

    const btn = document.getElementById("scanBtn");
    const resultBox = document.getElementById("result");

    btn.addEventListener("click", async () => {

        resultBox.innerText = "Scanning...";

        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        let url = tab?.url;

        if (!url) {
            resultBox.innerText = "Invalid URL";
            return;
        }

        fetch("http://127.0.0.1:5000/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: url })
        })
        .then(res => res.json())
        .then(data => {

            resultBox.innerText =
                data.result + " (Score: " + data.score + ")";

            resultBox.style.color =
                data.score > 50 ? "red" : "green";

        })
        .catch(() => {
            resultBox.innerText = "Backend not connected";
        });

    });


document.getElementById("scanBtn").addEventListener("click", async () => {

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let url = tab.url;

  document.getElementById("url").innerText = url;

  // 🔗 Ask content.js if login form exists
  let response = await chrome.tabs.sendMessage(tab.id, { action: "checkLoginForm" });
  let hasPasswordField = response?.hasPassword;

  let riskScore = 0;
  let reasons = [];

  // 🔍 URL Checks
  if (url.includes("@")) {
    riskScore += 30;
    reasons.push("Contains '@'");
  }

  if (url.length > 75) {
    riskScore += 15;
    reasons.push("Very long URL");
  }

  if (url.includes("bit.ly") || url.includes("tinyurl")) {
    riskScore += 25;
    reasons.push("Shortened URL");
  }

  if (url.includes("login") || url.includes("verify") || url.includes("bank")) {
    riskScore += 20;
    reasons.push("Suspicious keywords");
  }

  if (!url.startsWith("https")) {
    riskScore += 10;
    reasons.push("Not HTTPS");
  }

  // 🔐 Login Form Detection
  if (hasPasswordField) {
    riskScore += 25;
    reasons.push("Login form detected");
  }

  // 🎯 UI Elements
  let resultBox = document.getElementById("resultBox");
  let status = document.getElementById("status");
  let details = document.getElementById("details");

  resultBox.classList.remove("hidden");

  // 🧠 Decision Logic
  if (riskScore >= 60) {
    resultBox.className = "danger";
    status.innerText = "Phishing Detected";
  } else if (riskScore >= 30) {
    resultBox.className = "danger";
    status.innerText = "Suspicious Website";
  } else {
    resultBox.className = "safe";
    status.innerText = "Safe Website";
  }

  details.innerHTML = `
    Risk Score: ${riskScore}/100 <br>
    Password Field: ${hasPasswordField ? "Yes" : "No"} <br>
    ${reasons.length ? "<br>Reasons:<br>- " + reasons.join("<br>- ") : ""}
  `;
});