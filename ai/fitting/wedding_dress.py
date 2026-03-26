import requests
import base64
import mimetypes
from pathlib import Path
from dotenv import load_dotenv
import os

# ==============================
# 설정
# ==============================

load_dotenv()
GMS_KEY = os.getenv("GMS_KEY")
URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"

PERSON_PATH = "person7.jpg"          # 최종 인물 기준
DRESS_PATH = "dress.jpg"        # 드레스 참고용
DRESS_ONLY_PATH = "dress_cleaned.png"  # 1차 결과: 드레스만 남긴 이미지
OUTPUT_PATH = "result_final.png"     # 2차 결과: 최종 합성 결과

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
# 실행
# ==============================
if __name__ == "__main__":
    if not GMS_KEY:
        print("❌ GMS_KEY를 입력하세요.")
    else:
        try:
            if not Path(PERSON_PATH).exists():
                raise FileNotFoundError(f"PERSON_PATH 파일이 없습니다: {PERSON_PATH}")
            if not Path(DRESS_PATH).exists():
                raise FileNotFoundError(f"DRESS_PATH 파일이 없습니다: {DRESS_PATH}")


            generate_final_result()

            print("\n🎉 전체 작업 완료")

            print(f"- 최종 합성 결과: {OUTPUT_PATH}")

        except Exception as e:
            print("❌ 오류:", e)
