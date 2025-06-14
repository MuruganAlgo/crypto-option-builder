# app.py
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from delta_rest_client import DeltaRestClient
import time

app = Flask(__name__)
CORS(app) # For development, consider restricting origins in production

# IMPORTANT: Load API keys from environment variables
DELTA_API_KEY = os.environ.get("DELTA_API_KEY")
DELTA_API_SECRET = os.environ.get("DELTA_API_SECRET")

# Define the Delta Exchange base URL
DELTA_BASE_URL = "https://api.delta.exchange" # Or testnet URL if you're using it
# Initialize DeltaRestClient only if keys are available
delta_client = None
if DELTA_API_KEY and DELTA_API_SECRET:
    delta_client = DeltaRestClient(
        base_url=DELTA_BASE_URL,
        api_key=DELTA_API_KEY,
        api_secret=DELTA_API_SECRET
    )
else:
    print("Warning: Delta Exchange API keys not found. API endpoints may not work.")


# --- API Endpoints for your Frontend ---
@app.route('/api/products', methods=['GET'])
def get_products():
    if not delta_client:
        return jsonify({"error": "API keys not configured."}), 500
    try:
        products = delta_client.get_products()
        return jsonify(products)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ticker/<symbol>', methods=['GET'])
def get_ticker_data(symbol):
    if not delta_client:
        return jsonify({"error": "API keys not configured."}), 500
    try:
        ticker = delta_client.get_ticker(symbol)
        return jsonify(ticker)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add other routes as needed for your specific data pulling

# This part is crucial for Render:
# When deployed, Flask apps are typically run by a WSGI server (like Gunicorn).
# You don't call app.run() directly for production.
# The `if __name__ == '__main__':` block is only for local testing.
if __name__ == '__main__':
    app.run(debug=True, port=5000) # Only for local development
