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

});