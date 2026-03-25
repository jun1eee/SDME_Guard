import base64
import mimetypes
import os
import tempfile
from dotenv import load_dotenv

import requests
import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ==============================
# 설정
# ==============================

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
GMS_KEY = os.getenv("GMS_KEY")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"

app = FastAPI(title="Dress Fitting API")

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

def _encode_image(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def _guess_mime(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    return mime or "image/jpeg"

def _extract_b64(result_json: dict) -> str | None:
    for c in result_json.get("candidates", []):
        for p in c.get("content", {}).get("parts", []):
            if "inlineData" in p and "data" in p["inlineData"]:
                return p["inlineData"]["data"]
            if "inline_data" in p and "data" in p["inline_data"]:
                return p["inline_data"]["data"]
    return None

def _call_gemini(prompt: str, image_paths: list[str], output_path: str):
    headers = {"Content-Type": "application/json", "X-goog-api-key": GMS_KEY}
    parts = [{"text": prompt}]
    for p in image_paths:
        parts.append({"inline_data": {"mime_type": _guess_mime(p), "data": _encode_image(p)}})

    resp = requests.post(
        GEMINI_URL,
        headers=headers,
        json={"contents": [{"parts": parts}]},
        timeout=180,
    )
    if resp.status_code != 200:
        print("❌ Gemini 응답 오류:", resp.text)
        resp.raise_for_status()

    b64 = _extract_b64(resp.json())
    if not b64:
        raise RuntimeError("Gemini 응답에서 이미지 데이터를 찾지 못했습니다.")

    with open(output_path, "wb") as f:
        f.write(base64.b64decode(b64))
    print(f"✅ 저장 완료: {output_path}")

# ==============================
# API
# ==============================

@app.get("/")
def root():
    return {"message": "Dress Fitting server running"}

@app.get("/health")
def health():
    return {"status": "ok", "gms_key_exists": bool(GMS_KEY)}

@app.post("/generate")
async def generate(
    person_image: UploadFile = File(..., description="사용자 전신 사진"),
    dress_image_url: str = Form(..., description="드레스 이미지 URL"),
):
    if not GMS_KEY:
        raise HTTPException(status_code=500, detail="GMS_KEY가 설정되지 않았습니다.")

    person_bytes = await person_image.read()
    if not person_bytes:
        raise HTTPException(status_code=400, detail="사람 이미지가 비어있습니다.")

    if person_image.content_type and not person_image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")

    # 드레스 이미지 URL 다운로드
    async with httpx.AsyncClient(timeout=30) as client:
        dress_resp = await client.get(dress_image_url)
        if dress_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="드레스 이미지를 가져올 수 없습니다.")
        dress_bytes = dress_resp.content

    try:
        with tempfile.TemporaryDirectory() as tmp:
            person_path = os.path.join(tmp, "person.jpg")
            dress_path = os.path.join(tmp, "dress.jpg")
            dress_only_path = os.path.join(tmp, "dress_only.png")
            output_path = os.path.join(tmp, "result.png")

            with open(person_path, "wb") as f:
                f.write(person_bytes)
            with open(dress_path, "wb") as f:
                f.write(dress_bytes)

            # 1차: 드레스만 추출
            print("🚀 1차 생성 중... 드레스만 남기는 중")
            _call_gemini(
                prompt="이 이미지에서 사람이나 부수적인 것은 모두 지우고 드레스만 남겨라",
                image_paths=[dress_path],
                output_path=dress_only_path,
            )

            # 2차: 인물 + 드레스 합성
            print("🚀 2차 생성 중... 인물 + 드레스 합성")
            _call_gemini(
                prompt="""
Source A (Subject): first image - the person
Source B (Dress): second image - the dress

1. Identity Lock (Critical)
- Keep the exact same face, identity, body shape, proportions, pose, and expression from Source A.
- Do NOT modify or regenerate the face.
- Do NOT make the body slimmer or different.

2. Strict Dress Extraction (From SECOND image)
- Use Source B ONLY for the dress design.
- Completely ignore any person in Source B.

Apply the dress with high fidelity:
- Preserve the overall design and structure of the dress
- Preserve key features such as silhouette, neckline, waistline, and fabric details
- The dress must NOT be simplified or redesigned.
- The dress must match the design from Source B as closely as possible.
- The upper part of the dress (bust, neckline, and straps) must remain consistent with the original design.

Veil rule:
- If a veil exists in Source B, include it naturally.
- If no veil exists, do NOT add one.

3. Editing Rules
- Replace ONLY the clothing on Source A.
- Adapt the dress to the exact body and pose of Source A.
- Remove any existing clothing and accessories (e.g., bag).
- The body must be reconstructed naturally after removing clothing.

4. Background
- Use a clean, bright white studio background.

5. Output Constraints
- EXACTLY ONE person, same as Source A, wearing the dress from Source B.
""",
                image_paths=[person_path, dress_only_path],
                output_path=output_path,
            )

            with open(output_path, "rb") as f:
                result_b64 = base64.b64encode(f.read()).decode()

        print("🎉 피팅 완료")
        return JSONResponse(content={"success": True, "data": {"result_b64": result_b64}})

    except requests.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Gemini API 호출 실패: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# 로컬 실행
# ==============================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
