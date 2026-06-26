"""Captura de frames da webcam com OpenCV (BGR → RGB)."""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Optional, Union

import cv2
import numpy as np


@dataclass
class CaptureResult:
    ok: bool
    frame_rgb: Optional[np.ndarray]
    message: str


def frame_bgr_to_rgb(frame_bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)


def open_capture(device_index: int = 0) -> Optional[cv2.VideoCapture]:
    cap = cv2.VideoCapture(device_index)
    if not cap.isOpened():
        return None
    return cap


def read_frame_rgb(cap: cv2.VideoCapture) -> CaptureResult:
    ok, frame = cap.read()
    if not ok or frame is None:
        return CaptureResult(False, None, "Não foi possível ler o frame da webcam.")
    rgb = frame_bgr_to_rgb(frame)
    return CaptureResult(True, rgb, "OK")


def resize_for_processing(frame_rgb: np.ndarray, max_side: int = 640) -> np.ndarray:
    h, w = frame_rgb.shape[:2]
    side = max(h, w)
    if side <= max_side:
        return frame_rgb
    scale = max_side / float(side)
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(frame_rgb, (new_w, new_h), interpolation=cv2.INTER_AREA)


def pil_image_to_rgb_array(image: Union[None, np.ndarray, io.BytesIO, object]) -> np.ndarray:
    """
    Converte saída de ``st.camera_input`` (UploadedFile), PIL Image ou ndarray para RGB uint8.

    O ``st.camera_input`` devolve um objeto *file-like* (bytes JPEG/PNG), não uma PIL Image.
    """
    from PIL import Image

    if image is None:
        raise ValueError("Imagem ausente.")

    if isinstance(image, np.ndarray):
        arr = image
        if arr.dtype != np.uint8:
            arr = np.clip(arr, 0, 255).astype(np.uint8)
        if arr.ndim == 2:
            return np.asarray(Image.fromarray(arr).convert("RGB"))
        if arr.ndim == 3 and arr.shape[2] == 4:
            return np.asarray(Image.fromarray(arr, mode="RGBA").convert("RGB"))
        if arr.ndim == 3 and arr.shape[2] == 3:
            return np.ascontiguousarray(arr)
        raise ValueError(f"Array de imagem com formato inesperado: shape={arr.shape}")

    if isinstance(image, Image.Image):
        return np.asarray(image.convert("RGB"))

    # Streamlit UploadedFile / BytesIO / arquivo com bytes de imagem
    if hasattr(image, "read"):
        try:
            image.seek(0)
        except (AttributeError, io.UnsupportedOperation, OSError):
            pass
        pil = Image.open(image)
        return np.asarray(pil.convert("RGB"))

    raise TypeError(f"Tipo de imagem não suportado: {type(image)!r}")
