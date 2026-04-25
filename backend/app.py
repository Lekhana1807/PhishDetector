from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import os

app = Flask(__name__)
CORS(app)

# =========================
# LOAD MODEL
# =========================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "dataset", "phishguard_model.pkl")

model = pickle.load(open(MODEL_PATH, "rb"))

# =========================
# HOME
# =========================
@app.route("/")
def home():
    return "PhishGuard AI Running"

# =========================
# ANALYZE (FIXED)
# =========================
@app.route("/analyze", methods=["POST"])
def analyze():

    data = request.get_json(silent=True)

    # ✔ must receive FEATURES, not URL
    if not data or "features" not in data:
        return jsonify({
            "error": "Send feature array, not URL"
        }), 400

    features = data["features"]

    # prediction
    prediction = model.predict([features])[0]

    print("Features:", features)
    print("Prediction:", prediction)

    if prediction == 1:
        result = "⚠️ Dangerous (Phishing Site)"
        score = 90
    else:
        result = "✅ Safe Website"
        score = 10

    return jsonify({
        "result": result,
        "score": score
    })

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(debug=True)