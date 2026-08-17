import os
import tempfile
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from paddleocr import PaddleOCR
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

app = FastAPI(title="Finomir PaddleOCR")
# Модель загружается один раз при старте процесса и повторно используется.
ocr = PaddleOCR(
    text_detection_model_name="PP-OCRv5_mobile_det",
    text_recognition_model_name="eslav_PP-OCRv5_mobile_rec",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)
MAX_BYTES = int(os.getenv("OCR_MAX_FILE_MB", "20")) * 1024 * 1024


def prepare_image(data: bytes, target: Path) -> None:
    with Image.open(__import__("io").BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        image.thumbnail((2000, 2000), Image.Resampling.LANCZOS)
        gray = ImageOps.grayscale(image)
        gray = ImageEnhance.Contrast(gray).enhance(1.25).filter(ImageFilter.SHARPEN)
        array = np.array(gray)
        points = np.column_stack(np.where(array < 245))
        if len(points) > 100:
            angle = cv2.minAreaRect(points[:, ::-1].astype(np.float32))[-1]
            angle = -(90 + angle) if angle < -45 else -angle
            if abs(angle) <= 12:
                center = (array.shape[1] // 2, array.shape[0] // 2)
                array = cv2.warpAffine(array, cv2.getRotationMatrix2D(center, angle, 1), (array.shape[1], array.shape[0]), borderValue=255)
        Image.fromarray(array).save(target, "PNG", optimize=True)


@app.get("/health")
def health(): return {"status": "ok", "model": "paddleocr-ru"}


@app.post("/recognize")
async def recognize(file: UploadFile = File(...)):
    data = await file.read()
    if not data or len(data) > MAX_BYTES: raise HTTPException(422, "Недопустимый размер файла")
    if file.content_type not in {"image/jpeg", "image/png"}: raise HTTPException(422, "OCR принимает JPEG или PNG")
    with tempfile.TemporaryDirectory(prefix="finomir-ocr-") as directory:
        path = Path(directory) / "prepared.png"
        try: prepare_image(data, path)
        except Exception: raise HTTPException(422, "Не удалось прочитать изображение")
        result = ocr.predict(str(path))
        blocks = []
        for page in result:
            payload = page.json if hasattr(page, "json") else page
            payload = payload() if callable(payload) else payload
            payload = payload.get("res", payload) if isinstance(payload, dict) else {}
            texts = payload.get("rec_texts", []); scores = payload.get("rec_scores", []); boxes = payload.get("rec_boxes", [])
            for index, text in enumerate(texts):
                box = boxes[index].tolist() if index < len(boxes) and hasattr(boxes[index], "tolist") else (boxes[index] if index < len(boxes) else [])
                blocks.append({"text": text, "confidence": float(scores[index]) if index < len(scores) else 0.0, "box": box})
        return {"text": "\n".join(item["text"] for item in blocks), "blocks": blocks}
