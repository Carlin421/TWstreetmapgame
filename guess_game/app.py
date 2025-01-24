from flask import Flask, request, jsonify, render_template
import firebase_admin
from firebase_admin import credentials, firestore, storage
import os
import uuid 
import random
from werkzeug.utils import secure_filename
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 1. 初始化 Firebase Admin
cred = credentials.Certificate("guess_game/streetmap-2c88d-firebase-adminsdk-fbsvc-66f551ad2f.json")  
firebase_admin.initialize_app(cred, {
    "storageBucket": "streetmap-2c88d.firebasestorage.app"  # 修改為你的 bucket 名稱
})

# 2. 建立 Firestore & Storage 物件
db = firestore.client()
bucket = storage.bucket()

# 測試首頁路由
@app.route("/")
def index():
    google_maps_api_key = "AIzaSyA7OqiN-0qXKdhHF6BPDOSZ8TjdpNTxLW8"  # 替換為您的 Google Maps API 密鑰
    return render_template("game.html", google_maps_api_key=google_maps_api_key)

@app.route("/upload", methods=["GET"])
def upload_page():
    # 返回一個簡單的HTML上傳表單
    return render_template("upload.html")

@app.route("/upload_video", methods=["POST"])
def upload_video():
    try:
        file = request.files.get("video_file")
        if not file:
            return jsonify({"error": "No file uploaded"}), 400

        lat = request.form.get("lat")
        lng = request.form.get("lng")
        title = request.form.get("title", "")
        description = request.form.get("description", "")

        if not lat or not lng:
            return jsonify({"error": "lat and lng are required"}), 400

        # 1. 檔名處理
        original_filename = secure_filename(file.filename)
        ext = original_filename.split('.')[-1].lower()  # mp4 等
        unique_filename = f"{uuid.uuid4()}.{ext}"

        # 2. 將檔案上傳到 Firebase Storage
        blob = bucket.blob(unique_filename)
        blob.upload_from_file(file, content_type="video/mp4")
        # 可設定存取權限(若需要公開連結)
        blob.make_public()
        file_url = blob.public_url  # 獲得公開連結

        # 3. 寫入 Firestore
        doc_ref = db.collection("videos").document()
        doc_data = {
            "title": title,
            "description": description,
            "video_url": file_url,
            "lat": float(lat),
            "lng": float(lng),
            "created_at": firestore.SERVER_TIMESTAMP
        }
        doc_ref.set(doc_data)

        return jsonify({"message": "Upload successful", "video_url": file_url})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/random_video", methods=["GET"])
def random_video():
    try:
        videos_ref = db.collection("videos").get()
        videos = [doc.to_dict() for doc in videos_ref]

        if not videos:
            print("No videos found in the database")  # 添加日誌
            return jsonify({"error": "No videos found"}), 404

        chosen_video = random.choice(videos)
        print(f"Chosen video: {chosen_video}")  # 添加日誌

        return jsonify({
            "video_url": chosen_video["video_url"],
            "title": chosen_video["title"],
            "lat": chosen_video["lat"],
            "lng": chosen_video["lng"]
        })

    except Exception as e:
        print(f"Error in random_video: {str(e)}")  # 添加日誌
        return jsonify({"error": str(e)}), 500

@app.route("/validate_guess", methods=["POST"])
def validate_guess():
    try:
        guessed_lat = float(request.json.get("lat"))
        guessed_lng = float(request.json.get("lng"))
        actual_lat = float(request.json.get("actual_lat"))
        actual_lng = float(request.json.get("actual_lng"))

        distance = ((actual_lat - guessed_lat) ** 2 + (actual_lng - guessed_lng) ** 2) ** 0.5
        if distance < 0.1:
            return jsonify({"result": "correct", "distance": distance})
        else:
            return jsonify({"result": "incorrect", "distance": distance})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
