import base64
import os
from typing import Optional

import requests

# 선택 기능: 얼굴 복원 후처리
# 설치:
# pip install opencv-python mediapipe numpy
USE_FACE_RESTORE = False

if USE_FACE_RESTORE:
    import cv2
    import numpy as np
    import mediapipe as mp


# =========================
# 설정
# =========================
GMS_KEY = ""
API_URL = "https://gms.ssafy.io/gmsapi/api.openai.com/v1/images/edits"

PERSON_IMAGE = "person.jpg"   # 기준 사람 사진
DRESS_IMAGE = "dress.jpg"     # 드레스 화보 사진

STEP1_OUTPUT = "result_step1.png"   # 옷만 교체
STEP2_OUTPUT = "result_step2.png"   # 배경까지 변경
FINAL_OUTPUT = "result_final.png"   # 얼굴 복원까지 적용한 최종본


# =========================
# 프롬프트
# =========================
STEP1_PROMPT = """
Use image 1 as the base person.

Preserve the exact identity, face, hairstyle, body shape, proportions, and pose of image 1.

The face must remain EXACTLY the same.

Do not modify the face in any way.

Do not change:
- eyes
- nose
- lips
- jawline
- skin tone
- hairstyle

Do not beautify, retouch, smooth, enhance, or restyle the face.

Only replace the clothing with the wedding dress from image 2.

Preserve the full dress silhouette, skirt volume, neckline, waistline, lace details, and fabric texture from image 2.

Do not change the background.

The final image must look like the same real person from image 1 wearing the dress from image 2.
"""

STEP2_PROMPT = """
Keep the person exactly the same as image 1.

Do not change the face, identity, hairstyle, body, or pose.

Do not modify the person in any way.

Only change the background and scene to match the wedding photo style and studio environment of image 2.

Keep the same person unchanged.

The final image must look like the same real person from image 1 placed naturally into the wedding studio background of image 2.
"""


# =========================
# 유틸
# =========================
def save_b64_image(b64_data: str, output_path: str) -> None:
    with open(output_path, "wb") as f:
        f.write(base64.b64decode(b64_data))


def call_image_edit(
    image1_path: str,
    image2_path: str,
    prompt: str,
    output_path: str,
    quality: str = "low",
    size: str = "1024x1024",
    input_fidelity: str = "high",
    timeout: int = 180,
) -> dict:
    headers = {
        "Authorization": f"Bearer {GMS_KEY}"
    }

    data = {
        "model": "gpt-image-1.5",
        "prompt": prompt,
        "quality": quality,
        "input_fidelity": input_fidelity,
        "size": size,
    }

    with open(image1_path, "rb") as img1, open(image2_path, "rb") as img2:
        files = [
            ("image[]", (os.path.basename(image1_path), img1, "image/jpeg")),
            ("image[]", (os.path.basename(image2_path), img2, "image/jpeg")),
        ]

        response = requests.post(
            API_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=timeout,
        )

    print("=" * 60)
    print("status:", response.status_code)
    print("body:", response.text[:2000])

    response.raise_for_status()
    result = response.json()

    print("usage:", result.get("usage"))

    image_b64 = result["data"][0]["b64_json"]
    save_b64_image(image_b64, output_path)
    print(f"완료: {output_path}")

    return result


# =========================
# 선택 기능: 얼굴 복원 후처리
# =========================
def restore_face_from_original(
    original_person_path: str,
    generated_path: str,
    output_path: str,
) -> None:
    """
    원본 얼굴을 결과 이미지에 다시 덮어써서 얼굴 유사도를 높이는 후처리.
    정면/유사 정면 사진에서 가장 잘 동작.
    """
    if not USE_FACE_RESTORE:
        raise RuntimeError("USE_FACE_RESTORE=False 상태입니다.")

    mp_face = mp.solutions.face_mesh
    face_mesh = mp_face.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
    )

    src_bgr = cv2.imread(original_person_path)
    dst_bgr = cv2.imread(generated_path)

    if src_bgr is None or dst_bgr is None:
        raise FileNotFoundError("이미지 파일을 불러오지 못했습니다.")

    src_rgb = cv2.cvtColor(src_bgr, cv2.COLOR_BGR2RGB)
    dst_rgb = cv2.cvtColor(dst_bgr, cv2.COLOR_BGR2RGB)

    src_res = face_mesh.process(src_rgb)
    dst_res = face_mesh.process(dst_rgb)

    if not src_res.multi_face_landmarks or not dst_res.multi_face_landmarks:
        raise RuntimeError("얼굴 랜드마크를 찾지 못했습니다.")

    src_landmarks = src_res.multi_face_landmarks[0].landmark
    dst_landmarks = dst_res.multi_face_landmarks[0].landmark

    h1, w1 = src_bgr.shape[:2]
    h2, w2 = dst_bgr.shape[:2]

    # 얼굴 윤곽 근처 주요 점들
    face_indices = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323,
        361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
        176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
        162, 21, 54, 103, 67, 109
    ]

    src_points = []
    dst_points = []

    for idx in face_indices:
        sx = int(src_landmarks[idx].x * w1)
        sy = int(src_landmarks[idx].y * h1)
        dx = int(dst_landmarks[idx].x * w2)
        dy = int(dst_landmarks[idx].y * h2)
        src_points.append([sx, sy])
        dst_points.append([dx, dy])

    src_points = np.array(src_points, dtype=np.int32)
    dst_points = np.array(dst_points, dtype=np.int32)

    # 변환 행렬
    M, _ = cv2.estimateAffinePartial2D(
        src_points.astype(np.float32),
        dst_points.astype(np.float32),
        method=cv2.LMEDS
    )
    if M is None:
        raise RuntimeError("얼굴 정렬 행렬을 계산하지 못했습니다.")

    warped_face = cv2.warpAffine(
        src_bgr,
        M,
        (w2, h2),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REFLECT
    )

    # 마스크 생성
    mask = np.zeros((h2, w2), dtype=np.uint8)
    hull = cv2.convexHull(dst_points)
    cv2.fillConvexPoly(mask, hull, 255)
    mask = cv2.GaussianBlur(mask, (31, 31), 0)

    # seamlessClone용 중심
    x, y, w, h = cv2.boundingRect(hull)
    center = (x + w // 2, y + h // 2)

    blended = cv2.seamlessClone(
        warped_face,
        dst_bgr,
        mask,
        center,
        cv2.NORMAL_CLONE
    )

    cv2.imwrite(output_path, blended)
    print(f"얼굴 복원 완료: {output_path}")


# =========================
# 메인 파이프라인
# =========================
def main() -> None:
    if not GMS_KEY:
        raise ValueError("GMS_KEY를 입력하세요.")

    if not os.path.exists(PERSON_IMAGE):
        raise FileNotFoundError(f"{PERSON_IMAGE} 파일이 없습니다.")
    if not os.path.exists(DRESS_IMAGE):
        raise FileNotFoundError(f"{DRESS_IMAGE} 파일이 없습니다.")

    # STEP 1: 사람 유지 + 드레스만 교체
    call_image_edit(
        image1_path=PERSON_IMAGE,
        image2_path=DRESS_IMAGE,
        prompt=STEP1_PROMPT,
        output_path=STEP1_OUTPUT,
        quality="low",
        size="1024x1024",
        input_fidelity="high",
    )

    # STEP 2: STEP1 결과 유지 + 배경만 드레스 화보 스타일로 변경
    call_image_edit(
        image1_path=STEP1_OUTPUT,
        image2_path=DRESS_IMAGE,
        prompt=STEP2_PROMPT,
        output_path=STEP2_OUTPUT,
        quality="low",
        size="1024x1024",
        input_fidelity="high",
    )

    # STEP 3: 선택 - 원본 얼굴 복원
    if USE_FACE_RESTORE:
        restore_face_from_original(
            original_person_path=PERSON_IMAGE,
            generated_path=STEP2_OUTPUT,
            output_path=FINAL_OUTPUT,
        )
    else:
        print(f"최종 결과: {STEP2_OUTPUT}")
        print("원본 얼굴까지 더 강하게 유지하려면 USE_FACE_RESTORE = True 로 바꾸세요.")


if __name__ == "__main__":
    main()