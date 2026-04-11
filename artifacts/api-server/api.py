from flask import Flask, request, jsonify
from flask_cors import CORS

# import tool của bạn
from main import google_drive_tool

app = Flask(__name__)
CORS(app)

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    question = data.get("question")
    file_id = data.get("file_id")

    answer = google_drive_tool(question, file_id)

    return jsonify({
        "answer": answer
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)