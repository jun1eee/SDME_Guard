import requests
import base64
import mimetypes
from pathlib import Path
from dotenv import load_dotenv
import os
import shutil

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# ==============================
# 설정
# ==============================

load_dotenv()
GMS_KEY = os.getenv("GMS_KEY")
URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"

# 생성된 이미지를 다시 보낼 주소
FORWARD_BACKEND_URL = "http://localhost:9000/api/upload-result"

PERSON_PATH = "person.jpg"             # 최종 인물 기준
DRESS_PATH = "dress.jpg"               # 드레스 참고용
DRESS_ONLY_PATH = "dress_cleaned.png"   # 1차 결과: 드레스만 남긴 이미지
OUTPUT_PATH = "result_final.png"        # 2차 결과: 최종 합성 결과

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# 유틸
# ==============================
def encode_image(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def guess_mime_type(path: str) -> str:
    mime_type, _ = mimetypes.guess_type(path)
    return mime_type or "image/jpeg"

def extract_generated_image_b64(result_json: dict) -> str | None:
    for c in result_json.get("candidates", []):
        content = c.get("content", {})
        for p in content.get("parts", []):
            if "inlineData" in p and "data" in p["inlineData"]:
                return p["inlineData"]["data"]
            if "inline_data" in p and "data" in p["inline_data"]:
                return p["inline_data"]["data"]
    return None

def save_b64_image(image_b64: str, output_path: str):
    with open(output_path, "wb") as f:
        f.write(base64.b64decode(image_b64))

def call_gemini_image(prompt: str, image_paths: list[str], output_path: str):
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": GMS_KEY
    }

    parts = [{"text": prompt}]
    for image_path in image_paths:
        parts.append({
            "inline_data": {
                "mime_type": guess_mime_type(image_path),
                "data": encode_image(image_path)
            }
        })

    payload = {
        "contents": [
            {
                "parts": parts
            }
        ]
    }

    response = requests.post(URL, headers=headers, json=payload, timeout=180)

    if response.status_code != 200:
        print("❌ Gemini 응답 오류:")
        print(response.text)
        response.raise_for_status()

    result = response.json()
    image_b64 = extract_generated_image_b64(result)

    if not image_b64:
        raise RuntimeError("Gemini 응답에서 이미지 데이터를 찾지 못했습니다.")

    save_b64_image(image_b64, output_path)
    print(f"✅ 저장 완료: {output_path}")

# ==============================
# 1차: 드레스만 남기기
# ==============================
def generate_dress_only():
    prompt = """
DRESS_PATH에서 사람이나 부수적인것은 모두 지우고 드레스만 남겨라
"""
    print("🚀 1차 생성 중... 드레스만 남기는 중")
    call_gemini_image(
        prompt=prompt,
        image_paths=[DRESS_PATH],
        output_path=DRESS_ONLY_PATH
    )

# ==============================
# 2차: 인물 + 드레스 합성
# ==============================
def generate_final_result():
    prompt = """
Source A (Subject): PERSON_PATH
Source B (Dress): DRESS_ONLY_PATH

1. Identity Lock (Critical)
- PERSON_PATH is the ONLY person in the result.
- Keep the exact same face, identity, body shape, proportions, pose, and expression.
- Do NOT modify or regenerate the face.
- Do NOT make the body slimmer or different.

2. Strict Dress Extraction (From SECOND image)
- Use DRESS_ONLY_PATH ONLY for the dress design.
- Completely ignore the person in DRESS_ONLY_PATH.

Apply the dress with high fidelity:
- Preserve the overall design and structure of the dress
- Preserve key features such as silhouette and general shape

Important:
- The dress must NOT be simplified.
- The dress must NOT be redesigned or reinterpreted.
- Do not add extra layers or change the skirt style.
- The dress must match the design from DRESS_ONLY_PATH as closely as possible.
- The dress must be resized and expanded to properly fit the body.
- The upper part of the dress (bust, neckline, and straps) must remain consistent with the original design.
- Do not alter the bust shape, neckline style, or strap structure.
- The top of the dress must not be redesigned to fit the body.

Veil rule:
- If a veil exists in DRESS_ONLY_PATH, include it naturally.
- If no veil exists, do NOT add one.

3. Editing Rules
- Replace ONLY the clothing on PERSON_PATH.
- Adapt the dress to the exact body and pose of PERSON_PATH.
- Even skin-tight clothing must be fully removed before applying the dress.
- The body shape must be treated as the natural human body, not influenced by previous clothing.
- Remove any existing accessories (e.g., bag).
- The body must be reconstructed naturally after removing clothing.
- Removing clothing must not be blocked by body shape preservation rules.

4. Background
- Use a clean, bright white studio background.

5. Output Constraints
- EXACTLY ONE person.
- Same person as FIRST image.
- Dress must strongly match SECOND image design.
"""
    print("🚀 2차 생성 중... 인물 + 드레스 합성")
    call_gemini_image(
        prompt=prompt,
        image_paths=[PERSON_PATH, DRESS_ONLY_PATH],
        output_path=OUTPUT_PATH
    )

# ==============================
# 파일 저장 / 검증
# ==============================
def save_upload_file(upload_file: UploadFile, destination: str):
    with open(destination, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

def validate_image_file(upload_file: UploadFile):
    if upload_file.content_type and not upload_file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"{upload_file.filename} 는 이미지 파일이 아닙니다."
        )

# ==============================
# 생성 결과를 다른 백엔드로 전송
# ==============================
def forward_result_to_backend(image_path: str):
    if not FORWARD_BACKEND_URL:
        raise RuntimeError("FORWARD_BACKEND_URL이 설정되지 않았습니다.")

    with open(image_path, "rb") as f:
        files = {
            "file": ("result_final.png", f, "image/png")
        }

        # 필요하면 추가 데이터 같이 전송
        data = {
            "source": "fastapi-gemini-server"
        }

        response = requests.post(
            FORWARD_BACKEND_URL,
            files=files,
            data=data,
            timeout=180
        )

    if response.status_code != 200:
        print("❌ 결과 이미지 전송 실패:")
        print(response.text)
        response.raise_for_status()

    # 상대 백엔드가 JSON 반환한다고 가정
    try:
        return response.json()
    except Exception:
        return {
            "status_code": response.status_code,
            "text": response.text
        }

# ==============================
# API
# ==============================
@app.get("/")
def root():
    return {"message": "server running"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "gms_key_exists": bool(GMS_KEY),
        "forward_backend_url_exists": bool(FORWARD_BACKEND_URL),
        "person_path": PERSON_PATH,
        "dress_path": DRESS_PATH,
        "dress_only_path": DRESS_ONLY_PATH,
        "output_path": OUTPUT_PATH
    }

@app.post("/generate")
async def generate(
    person: UploadFile = File(...),
    dress: UploadFile = File(...)
):
    if not GMS_KEY:
        raise HTTPException(status_code=500, detail="GMS_KEY가 설정되지 않았습니다.")

    try:
        validate_image_file(person)
        validate_image_file(dress)

        # 업로드 받은 파일을 기존 경로에 저장
        save_upload_file(person, PERSON_PATH)
        save_upload_file(dress, DRESS_PATH)

        if not Path(PERSON_PATH).exists():
            raise FileNotFoundError(f"PERSON_PATH 파일이 없습니다: {PERSON_PATH}")
        if not Path(DRESS_PATH).exists():
            raise FileNotFoundError(f"DRESS_PATH 파일이 없습니다: {DRESS_PATH}")

        # 1차 생성
        generate_dress_only()

        # 2차 생성
        generate_final_result()

        if not Path(OUTPUT_PATH).exists():
            raise FileNotFoundError(f"결과 파일이 생성되지 않았습니다: {OUTPUT_PATH}")

        # 생성된 결과를 다른 백엔드 서버로 전송
        forward_response = forward_result_to_backend(OUTPUT_PATH)

        return JSONResponse({
            "message": "이미지 생성 후 백엔드 서버로 전송 완료",
            "forward_response": forward_response
        })

    except requests.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"외부 API 호출 실패: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# 로컬 실행
# ==============================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)