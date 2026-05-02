from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import os
import math
import logging
import re
from urllib.parse import urlparse

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)

# =========================
# LOAD MODEL
# =========================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "dataset", "phishguard_model.pkl")

model = None
model_load_error = None
expected_feature_count = None
shortener_pattern = re.compile(r"(bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|is\.gd|buff\.ly)", re.IGNORECASE)

try:
    with open(MODEL_PATH, "rb") as model_file:
        model = pickle.load(model_file)
    expected_feature_count = getattr(model, "n_features_in_", None)
    app.logger.info("Model loaded successfully from %s", MODEL_PATH)
except Exception as exc:
    model_load_error = str(exc)
    app.logger.exception("Failed to load model from %s", MODEL_PATH)


def _safe_signal(signals, key, default=False):
    if not isinstance(signals, dict):
        return default
    return bool(signals.get(key, default))


def _safe_redirect_count(signals):
    if not isinstance(signals, dict):
        return 0
    try:
        return max(0, int(signals.get("redirectCount", 0)))
    except (TypeError, ValueError):
        return 0


def _build_features_from_url(raw_url, page_signals=None):
    parsed = urlparse(raw_url)
    hostname = (parsed.hostname or "").lower()
    full_url = raw_url.lower()

    if not hostname:
        raise ValueError("Invalid URL: hostname missing")

    hostname_parts = [part for part in hostname.split(".") if part]
    subdomain_count = max(0, len(hostname_parts) - 2)

    has_ip = bool(re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", hostname))
    is_shortened = bool(shortener_pattern.search(hostname))
    has_at = "@" in raw_url
    has_double_slash_redirect = full_url.rfind("//") > 7
    has_hyphen_prefix = "-" in hostname
    has_https_token_misuse = "https" in full_url and parsed.scheme != "https"
    redirect_count = _safe_redirect_count(page_signals)

    features = [
        1 if has_ip else -1,  # having_IP_Address
        -1 if len(raw_url) < 54 else (0 if len(raw_url) <= 75 else 1),  # URL_Length
        1 if is_shortened else -1,  # Shortining_Service
        1 if has_at else -1,  # having_At_Symbol
        1 if has_double_slash_redirect else -1,  # double_slash_redirecting
        1 if has_hyphen_prefix else -1,  # Prefix_Suffix
        -1 if subdomain_count <= 1 else (0 if subdomain_count == 2 else 1),  # having_Sub_Domain
        1 if parsed.scheme == "https" else -1,  # SSLfinal_State
        0,  # Domain_registeration_length
        0,  # Favicon
        1,  # port
        1 if has_https_token_misuse else -1,  # HTTPS_token
        0,  # Request_URL
        0,  # URL_of_Anchor
        0,  # Links_in_tags
        0,  # SFH
        1 if _safe_signal(page_signals, "hasEmailForm") else -1,  # Submitting_to_email
        0,  # Abnormal_URL
        0 if redirect_count > 0 else -1,  # Redirect
        1 if _safe_signal(page_signals, "hasOnMouseOver") else -1,  # on_mouseover
        1 if _safe_signal(page_signals, "disablesRightClick") else -1,  # RightClick
        1 if _safe_signal(page_signals, "hasPopupWindow") else -1,  # popUpWidnow
        1 if _safe_signal(page_signals, "hasIframe") else -1,  # Iframe
        0,  # age_of_domain
        0,  # DNSRecord
        0,  # web_traffic
        0,  # Page_Rank
        0,  # Google_Index
        0,  # Links_pointing_to_page
        0,  # Statistical_report
    ]
    return features


def _predict_from_features(features):
    if expected_feature_count is not None and len(features) < expected_feature_count:
        return None, jsonify({
            "error": f"'features' must contain at least {expected_feature_count} values"
        }), 400

    try:
        parsed_features = [float(value) for value in features]
    except (TypeError, ValueError):
        return None, jsonify({
            "error": "All feature values must be numeric"
        }), 400

    was_truncated = False
    if expected_feature_count is not None and len(parsed_features) > expected_feature_count:
        parsed_features = parsed_features[:expected_feature_count]
        was_truncated = True

    if not all(math.isfinite(value) for value in parsed_features):
        return None, jsonify({
            "error": "Feature values must be finite numbers"
        }), 400

    try:
        prediction = int(model.predict([parsed_features])[0])
    except Exception:
        app.logger.exception("Prediction failed")
        return None, jsonify({
            "error": "Prediction failed. Check feature shape and model compatibility."
        }), 500

    score = None
    try:
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba([parsed_features])[0]
            classes = list(getattr(model, "classes_", []))
            if 0 in classes:
                phishing_index = classes.index(0)
                phishing_probability = float(probabilities[phishing_index])
                score = int(round(phishing_probability * 100))
    except Exception:
        app.logger.exception("Could not compute probability-based score")

    if score is None:
        score = 90 if prediction == 0 else 10

    if score >= 60:
        result = "⚠️ Dangerous (Phishing Site)"
    elif score >= 35:
        result = "⚠️ Suspicious Website"
    else:
        result = "✅ Safe Website"

    response = {
        "result": result,
        "score": score,
        "used_feature_count": len(parsed_features),
        "input_feature_count": len(features),
        "truncated_input": was_truncated
    }
    return response, None, None

# =========================
# HOME
# =========================
@app.route("/")
def home():
    return "PhishGuard AI Running"


@app.route("/model-info", methods=["GET"])
def model_info():
    if model is None:
        return jsonify({
            "model_loaded": False,
            "error": model_load_error
        }), 503
    return jsonify({
        "model_loaded": True,
        "expected_feature_count": expected_feature_count
    })

# =========================
# ANALYZE (FIXED)
# =========================
@app.route("/analyze", methods=["POST"])
def analyze():
    if model is None:
        return jsonify({
            "error": "Model is unavailable",
            "details": model_load_error
        }), 503

    data = request.get_json(silent=True)

    if not isinstance(data, dict) or "features" not in data:
        return jsonify({
            "error": "Request body must include a 'features' array"
        }), 400

    features = data["features"]
    if not isinstance(features, list) or not features:
        return jsonify({
            "error": "'features' must be a non-empty array"
        }), 400

    response, error_response, status_code = _predict_from_features(features)
    if error_response is not None:
        return error_response, status_code
    return jsonify(response)


@app.route("/analyze-url", methods=["POST"])
def analyze_url():
    if model is None:
        return jsonify({
            "error": "Model is unavailable",
            "details": model_load_error
        }), 503

    data = request.get_json(silent=True)
    if not isinstance(data, dict) or "url" not in data:
        return jsonify({
            "error": "Request body must include a 'url' string"
        }), 400

    raw_url = str(data.get("url", "")).strip()
    if not raw_url:
        return jsonify({
            "error": "URL cannot be empty"
        }), 400
    if not (raw_url.startswith("http://") or raw_url.startswith("https://")):
        return jsonify({
            "error": "Only http/https URLs are supported"
        }), 400

    try:
        features = _build_features_from_url(raw_url, data.get("pageSignals"))
    except ValueError as exc:
        return jsonify({
            "error": str(exc)
        }), 400

    response, error_response, status_code = _predict_from_features(features)
    if error_response is not None:
        return error_response, status_code
    response["scanned_url"] = raw_url
    return jsonify(response)

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(debug=True)