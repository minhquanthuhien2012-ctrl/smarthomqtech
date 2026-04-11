from googleapiclient.discovery import build
from google.oauth2 import service_account
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import io

    # PDF + DOCX
import PyPDF2
from docx import Document

    # Gemini
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

    # ===== CONFIG =====
SERVICE_ACCOUNT_INFO = eval(os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON"))
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

credentials = service_account.Credentials.from_service_account_info(
        SERVICE_ACCOUNT_INFO, scopes=SCOPES
    )

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

    # ===== GOOGLE DRIVE SERVICE =====
def get_drive_service():
        return build('drive', 'v3', credentials=credentials)


    # ===== READ FILE =====
def read_txt(file_id):
        service = get_drive_service()
        request = service.files().get_media(fileId=file_id)
        return request.execute().decode("utf-8")


def read_google_doc(file_id):
        service = get_drive_service()
        request = service.files().export(
            fileId=file_id,
            mimeType="text/plain"
        )
        return request.execute().decode("utf-8")


def read_pdf(file_id):
        service = get_drive_service()
        request = service.files().get_media(fileId=file_id)
        file_data = request.execute()

        pdf = PyPDF2.PdfReader(io.BytesIO(file_data))
        text = ""
        for page in pdf.pages:
            text += page.extract_text() or ""

        return text


def read_docx(file_id):
        service = get_drive_service()
        request = service.files().get_media(fileId=file_id)
        file_data = request.execute()

        doc = Document(io.BytesIO(file_data))
        return "\n".join([p.text for p in doc.paragraphs])


def read_file(file_id, mime_type):
        try:
            if mime_type == "text/plain":
                return read_txt(file_id)

            elif mime_type == "application/vnd.google-apps.document":
                return read_google_doc(file_id)

            elif mime_type == "application/pdf":
                return read_pdf(file_id)

            elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                return read_docx(file_id)

            else:
                return f"[Không hỗ trợ: {mime_type}]"

        except Exception as e:
            return f"[Lỗi đọc file: {str(e)}]"


    # ===== LIST FILES =====
def list_files_in_folder(folder_id):
        service = get_drive_service()

        try:
            results = service.files().list(
                q=f"'{folder_id}' in parents",
                fields="files(id, name)"
            ).execute()

            return results.get('files', [])

        except Exception as e:
            print("❌ ERROR GOOGLE DRIVE:", str(e))
            return []

        return results.get('files', [])


    # ===== AI =====
def ask_ai(question, context):
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = f"""
    Bạn là trợ lý AI.

    Dữ liệu:
    {context}

    Câu hỏi:
    {question}
    """

        response = model.generate_content(prompt)
        return response.text


    # ===== MAIN TOOL =====
def google_drive_tool(question, folder_id):
    try:
        files = list_files_in_folder(folder_id)

        if not files:
            return "❌ Không tìm thấy file nào hoặc chưa cấp quyền Google Drive"

        all_content = ""

        for f in files:
            try:
                content = read_file(f["id"])
                all_content += f"\n\nFile: {f['name']}\n{content}"
            except Exception as e:
                print("❌ ERROR READ FILE:", e)
                continue

        return ask_ai(question, all_content)

    except Exception as e:
        return f"❌ Lỗi hệ thống: {str(e)}"


    # ===== API =====
@app.route("/chat", methods=["POST"])
def chat():
        data = request.json
        question = data.get("question")
        folder_id = data.get("file_id")

        result = google_drive_tool(question, folder_id)

        return jsonify({"answer": result})


    # ===== RUN =====
if __name__ == "__main__":
        app.run(host="0.0.0.0", port=5000)