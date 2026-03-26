import base64
import mimetypes
import os
import shutil
import tempfile

import httpx
import requests
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter(tags=["fitting"])


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


def _call_gemini(prompt: str, image_paths: list[str], output_path: str, gms_key: str):
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"
    headers = {"Content-Type": "application/json", "X-goog-api-key": gms_key}
    parts = [{"text": prompt}]
    for p in image_paths:
        parts.append({"inline_data": {"mime_type": _guess_mime(p), "data": _encode_image(p)}})
    resp = requests.post(
        url,
        headers=headers,
        json={"contents": [{"parts": parts}]},
        timeout=180,
    )
    resp.raise_for_status()
    b64 = _extract_b64(resp.json())
    if not b64:
        raise RuntimeError("Gemini 응답에서 이미지 데이터를 찾지 못했습니다.")
    with open(output_path, "wb") as f:
        f.write(base64.b64decode(b64))


@router.post("/generate")
async def dress_fitting(
    person_image: UploadFile = File(..., description="사용자 전신 사진"),
    dress_image_url: str = Form(..., description="드레스 이미지 URL"),
):
    """드레스 가상 피팅 - 사용자 전신 사진에 드레스를 AI로 합성합니다."""
    from config import settings

    gms_key = settings.gms_key
    if not gms_key:
        raise HTTPException(status_code=500, detail="GMS_KEY가 설정되지 않았습니다.")

    person_bytes = await person_image.read()
    if not person_bytes:
        raise HTTPException(status_code=400, detail="사람 이미지가 비어있습니다.")

    async with httpx.AsyncClient(timeout=30) as client:
        dress_resp = await client.get(dress_image_url)
        if dress_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="드레스 이미지를 가져올 수 없습니다.")
        dress_bytes = dress_resp.content

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
        _call_gemini(
            prompt="이 이미지에서 사람이나 부수적인 것은 모두 지우고 드레스만 남겨라",
            image_paths=[dress_path],
            output_path=dress_only_path,
            gms_key=gms_key,
        )

        # 2차: 인물 + 드레스 합성
        _call_gemini(
            prompt="""
Source A (Subject): first image - the person
Source B (Dress): second image - the dress

1. Identity Lock: Keep the exact same face, body shape, proportions, and pose from Source A.
2. Dress Application: Apply the dress from Source B onto the person in Source A with high fidelity.
   - Preserve silhouette, neckline, waistline, and fabric details.
   - Do NOT redesign or simplify the dress.
3. Background: Clean, bright white studio background.
4. Output: Exactly ONE person - same as Source A wearing the dress from Source B.
""",
            image_paths=[person_path, dress_only_path],
            output_path=output_path,
            gms_key=gms_key,
        )

        with open(output_path, "rb") as f:
            result_b64 = base64.b64encode(f.read()).decode()

    return JSONResponse(content={"success": True, "data": {"result_b64": result_b64}})