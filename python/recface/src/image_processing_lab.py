"""
Demonstrações para ementa (Unidades 2–3): filtragem espacial, convolução implícita
(Sobel), bordas Canny, limiarização Otsu, morfologia e contornos.

Uso apenas em laboratório / relatório pedagógico — independente do motor facial principal.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal, Tuple

import cv2
import numpy as np

OperationKind = Literal[
    "cinza",
    "gaussian",
    "sobel",
    "canny",
    "otsu_contornos",
    "histograma_cinza",
]


@dataclass
class ProcessingStep:
    """Resultado para exibir na UI: imagem RGB ou binária (como grayscale 3-canal quando preciso)."""

    title: str
    description: str
    image_rgb: np.ndarray
    is_binary_visual: bool


def _normalize_to_uint8_gray(arr: np.ndarray) -> np.ndarray:
    a = np.asarray(arr, dtype=np.float64)
    lo, hi = float(np.percentile(a, 2)), float(np.percentile(a, 98))
    if hi <= lo:
        hi = lo + 1e-8
    a = np.clip((a - lo) / (hi - lo), 0.0, 1.0)
    return (a * 255.0).astype(np.uint8)


def rgb_to_gray(rgb: np.ndarray) -> np.ndarray:
    rgb_u8 = np.clip(rgb, 0, 255).astype(np.uint8)
    return cv2.cvtColor(rgb_u8, cv2.COLOR_RGB2GRAY)


def grayscale_to_rgb_u8(gray: np.ndarray) -> np.ndarray:
    g = np.clip(gray, 0, 255).astype(np.uint8)
    return cv2.cvtColor(g, cv2.COLOR_GRAY2RGB)


def apply_gaussian(gray: np.ndarray, ksize: int) -> np.ndarray:
    k = max(int(ksize), 3)
    if k % 2 == 0:
        k += 1
    return cv2.GaussianBlur(gray, (k, k), 0)


def apply_sobel_magnitude(gray: np.ndarray) -> Tuple[np.ndarray, str]:
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)
    viz = _normalize_to_uint8_gray(mag)
    desc = (
        "**Magnitude** do gradiente **Sobel** (Gx, Gy sobre convoluções 3×3). Visualização normalizada "
        "(percentis 2–98) para destacar contornos e variações de intensidade."
    )
    return viz, desc


def apply_canny(gray: np.ndarray, t1: float, t2: float) -> np.ndarray:
    t1i = max(1, int(t1))
    t2i = max(1, int(t2))
    return cv2.Canny(gray, t1i, t2i)


def otsu_morph_contours(
    rgb: np.ndarray,
    close_ksize: int,
) -> Tuple[np.ndarray, np.ndarray, int, str]:
    """
    Retorna (máscara binária uint8, overlay RGB com contornos, num_contornos, descrição).
    """
    gray = rgb_to_gray(rgb)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    k = max(int(close_ksize), 3)
    if k % 2 == 0:
        k += 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    contours, _h = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    overlay = np.ascontiguousarray(rgb, dtype=np.uint8)
    cv2.drawContours(overlay, contours, -1, (0, 255, 0), 2)
    desc = (
        "**Otsu** automático + **fechamento morfológico** (preenche pequenas falhas) + **contornos** "
        f"externos (`{len(contours)}` regiões detectadas nesta visualização)."
    )
    return closed, overlay, len(contours), desc


def gray_histogram_curve(gray: np.ndarray) -> Tuple[np.ndarray, str]:
    """Imagem sintética (curva de histograma 256×120) em RGB para exibição."""
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).ravel()
    if float(hist.max()) > 0:
        hist = hist / float(hist.max())
    h_bar, w_bar = 120, 256
    canvas = np.zeros((h_bar, w_bar, 3), dtype=np.uint8)
    for x in range(256):
        col = int((1.0 - float(hist[x])) * (h_bar - 1))
        canvas[col:, x, :] = (200, 200, 255)
    desc = (
        "Histograma de intensidades (0–255) da imagem em cinza: base para **thresholding** "
        "e estatísticas simples de **textura global** (distribuição de cinzas)."
    )
    return canvas, desc


def run_operation(
    rgb: np.ndarray,
    op: OperationKind,
    gaussian_ksize: int = 5,
    canny_t1: float = 80.0,
    canny_t2: float = 160.0,
    morph_close_ksize: int = 5,
) -> ProcessingStep:
    rgb_u8 = np.clip(rgb, 0, 255).astype(np.uint8)
    gray = rgb_to_gray(rgb_u8)

    if op == "cinza":
        return ProcessingStep(
            "Escala de cinza",
            "Conversão **RGB → luminância** (ponderação padrão OpenCV). Base para filtros e segmentação.",
            grayscale_to_rgb_u8(gray),
            False,
        )
    if op == "gaussian":
        blurred = apply_gaussian(gray, gaussian_ksize)
        return ProcessingStep(
            "Suavização Gaussiana",
            "Filtragem espacial linear (convolução com kernel Gaussiano): **redução de ruído** "
            f"antes de gradientes ou limiares (kernel {gaussian_ksize}×{gaussian_ksize}).",
            grayscale_to_rgb_u8(blurred),
            False,
        )
    if op == "sobel":
        mag, d = apply_sobel_magnitude(gray)
        return ProcessingStep("Gradiente Sobel", d.strip(), grayscale_to_rgb_u8(mag), False)
    if op == "canny":
        edges = apply_canny(gray, canny_t1, canny_t2)
        return ProcessingStep(
            "Bordas Canny",
            f"Detector **Canny** (t1={int(canny_t1)}, t2={int(canny_t2)}): supressão não-máxima + limiares duplos.",
            grayscale_to_rgb_u8(edges),
            False,
        )
    if op == "otsu_contornos":
        _bin, overlay, n, d = otsu_morph_contours(rgb_u8, morph_close_ksize)
        return ProcessingStep("Otsu + morfologia + contornos", d, overlay, False)
    if op == "histograma_cinza":
        curve, d = gray_histogram_curve(gray)
        return ProcessingStep("Histograma (cinza)", d, curve, False)

    raise ValueError(f"Operação desconhecida: {op!r}")


def list_operations() -> List[Tuple[OperationKind, str]]:
    return [
        ("cinza", "Grayscale (representação digital)"),
        ("gaussian", "Gaussiana — suavização / redução de ruído"),
        ("sobel", "Sobel — gradiente e bordas"),
        ("canny", "Canny — detecção de bordas"),
        ("otsu_contornos", "Otsu + morfologia + contornos"),
        ("histograma_cinza", "Histograma de intensidades"),
    ]
