"""Detecção facial e embeddings: `face_recognition` (dlib) ou InsightFace+ONNX (pip puro)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Literal, Optional, Tuple

import numpy as np

FACE_ENGINE_INSTALL_MSG = (
    "Nenhum motor facial disponível neste Python. Instale dependências apenas com pip: "
    "`python -m pip install -r requirements.txt` (inclui onnxruntime + insightface). "
    "Na primeira execução o InsightFace baixa o modelo ONNX. "
    "Alternativa Docker/Conda com dlib: veja README.md."
)

_face_recognition_mod: Any = None
_face_recognition_state: Literal["unset", "ok", "missing"] = "unset"

_if_app: Any = None
_insightface_state: Literal["unset", "ok", "missing", "failed"] = "unset"
_insightface_error: str = ""


def _resolve_face_recognition() -> None:
    global _face_recognition_mod, _face_recognition_state
    if _face_recognition_state != "unset":
        return
    try:
        import face_recognition as _fr

        _face_recognition_mod = _fr
        _face_recognition_state = "ok"
    except ImportError:
        _face_recognition_mod = None
        _face_recognition_state = "missing"


FACIAL_MODELS_DIR = Path(__file__).resolve().parent.parent / "data" / ".insightface"


def _insightface_models_root() -> str:
    FACIAL_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    return str(FACIAL_MODELS_DIR)


def _resolve_insightface() -> None:
    global _if_app, _insightface_state, _insightface_error
    if _insightface_state != "unset":
        return
    try:
        from insightface.app import FaceAnalysis
    except ImportError:
        _if_app = None
        _insightface_state = "missing"
        _insightface_error = ""
        return

    try:
        app = FaceAnalysis(
            name="buffalo_s",
            root=_insightface_models_root(),
            providers=["CPUExecutionProvider"],
        )
        app.prepare(ctx_id=-1, det_size=(640, 640))
        _if_app = app
        _insightface_state = "ok"
        _insightface_error = ""
    except Exception as exc:  # noqa: BLE001 — mostrar erro útil na UI
        _if_app = None
        _insightface_state = "failed"
        _insightface_error = str(exc)


def face_engine_available() -> bool:
    """True se houver `face_recognition` **ou** InsightFace funcional."""
    _resolve_face_recognition()
    if _face_recognition_state == "ok":
        return True
    _resolve_insightface()
    return _insightface_state == "ok"


def active_engine_label() -> str:
    """Texto curto para a interface (qual backend está ativo)."""
    _resolve_face_recognition()
    if _face_recognition_state == "ok":
        return "Motor ativo: **face_recognition** (dlib/HOG)."
    _resolve_insightface()
    if _insightface_state == "ok":
        return (
            "Motor ativo: **InsightFace** (ONNX em CPU, modelo *buffalo_s*). "
            "Na primeira execução pode demorar enquanto o peso é baixado."
        )
    if _insightface_state == "failed" and _insightface_error:
        return f"InsightFace falhou ao iniciar: {_insightface_error}"
    return ""


def insightface_init_error() -> str:
    """Mensagem quando o pacote existe mas prepare() falhou (rede, disco, etc.)."""
    _resolve_insightface()
    if _insightface_state == "failed":
        return _insightface_error or "Falha desconhecida ao carregar InsightFace."
    return ""


@dataclass
class EncodeResult:
    ok: bool
    encoding: Optional[np.ndarray]
    face_locations: List[Tuple[int, int, int, int]]
    message: str


def _encode_face_recognition(
    image_rgb: np.ndarray,
    num_jitters: int,
    model: str,
) -> EncodeResult:
    fr = _face_recognition_mod
    if image_rgb.dtype != np.uint8:
        image_rgb = np.clip(image_rgb, 0, 255).astype(np.uint8)

    locations = fr.face_locations(image_rgb, model=model)
    if not locations:
        return EncodeResult(False, None, [], "Nenhum rosto detectado na imagem.")

    if len(locations) > 1:

        def area(loc: Tuple[int, int, int, int]) -> int:
            top, right, bottom, left = loc
            return (bottom - top) * (right - left)

        locations = [max(locations, key=area)]

    encodings = fr.face_encodings(
        image_rgb, known_face_locations=locations, num_jitters=num_jitters
    )
    if not encodings:
        return EncodeResult(False, None, locations, "Rosto detectado, mas falha ao gerar embedding.")

    return EncodeResult(True, encodings[0], locations, "Embedding gerado com sucesso.")


def _encode_insightface(image_rgb: np.ndarray) -> EncodeResult:
    import cv2

    assert _if_app is not None
    if image_rgb.dtype != np.uint8:
        image_rgb = np.clip(image_rgb, 0, 255).astype(np.uint8)

    bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    faces = _if_app.get(bgr)
    if not faces:
        return EncodeResult(False, None, [], "Nenhum rosto detectado na imagem.")

    if len(faces) > 1:

        def face_area(f: Any) -> float:
            x1, y1, x2, y2 = f.bbox
            return float(max(0.0, x2 - x1) * max(0.0, y2 - y1))

        faces = [max(faces, key=face_area)]

    face = faces[0]
    vec = _insightface_vector(face)
    loc_fr = _insightface_location(face)

    return EncodeResult(True, vec, [loc_fr], "Embedding gerado com sucesso (InsightFace).")


@dataclass
class FaceEncodingItem:
    encoding: np.ndarray
    location: Tuple[int, int, int, int]


@dataclass
class EncodeAllResult:
    ok: bool
    faces: List[FaceEncodingItem]
    message: str


def _insightface_vector(face: Any) -> np.ndarray:
    normed = getattr(face, "normed_embedding", None)
    if normed is not None:
        return np.asarray(normed, dtype=np.float64)
    vec = np.asarray(face.embedding, dtype=np.float64)
    nrm = np.linalg.norm(vec)
    if nrm > 1e-12:
        vec = vec / nrm
    return vec


def _insightface_location(face: Any) -> Tuple[int, int, int, int]:
    x1, y1, x2, y2 = face.bbox
    return int(y1), int(x2), int(y2), int(x1)


def _encode_all_face_recognition(
    image_rgb: np.ndarray,
    num_jitters: int,
    model: str,
) -> EncodeAllResult:
    fr = _face_recognition_mod
    if image_rgb.dtype != np.uint8:
        image_rgb = np.clip(image_rgb, 0, 255).astype(np.uint8)

    locations = fr.face_locations(image_rgb, model=model)
    if not locations:
        return EncodeAllResult(False, [], "Nenhum rosto detectado na imagem.")

    encodings = fr.face_encodings(
        image_rgb, known_face_locations=locations, num_jitters=num_jitters
    )
    faces: List[FaceEncodingItem] = []
    for encoding, location in zip(encodings, locations):
        if encoding is None:
            continue
        faces.append(FaceEncodingItem(encoding, location))

    if not faces:
        return EncodeAllResult(False, [], "Rostos detectados, mas falha ao gerar embeddings.")

    return EncodeAllResult(True, faces, f"{len(faces)} rosto(s) detectado(s).")


def _encode_all_insightface(image_rgb: np.ndarray) -> EncodeAllResult:
    import cv2

    assert _if_app is not None
    if image_rgb.dtype != np.uint8:
        image_rgb = np.clip(image_rgb, 0, 255).astype(np.uint8)

    bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    detected = _if_app.get(bgr)
    if not detected:
        return EncodeAllResult(False, [], "Nenhum rosto detectado na imagem.")

    faces = [
        FaceEncodingItem(_insightface_vector(face), _insightface_location(face))
        for face in detected
    ]
    return EncodeAllResult(True, faces, f"{len(faces)} rosto(s) detectado(s) (InsightFace).")


def encode_all_faces_from_rgb(
    image_rgb: np.ndarray,
    num_jitters: int = 1,
    model: str = "hog",
) -> EncodeAllResult:
    """Gera embeddings de todos os rostos detectados na imagem."""
    _resolve_face_recognition()
    if _face_recognition_state == "ok":
        return _encode_all_face_recognition(image_rgb, num_jitters=num_jitters, model=model)

    _resolve_insightface()
    if _insightface_state == "ok":
        return _encode_all_insightface(image_rgb)
    if _insightface_state == "failed":
        detail = (_insightface_error or "").strip()
        msg = (
            "Não foi possível carregar o motor InsightFace."
            + (f" Detalhe: {detail}" if detail else "")
        )
        return EncodeAllResult(False, [], msg)

    return EncodeAllResult(False, [], FACE_ENGINE_INSTALL_MSG)


def encode_face_from_rgb(
    image_rgb: np.ndarray,
    num_jitters: int = 1,
    model: str = "hog",
) -> EncodeResult:
    """Gera um único embedding do maior rostro encontrado."""
    _resolve_face_recognition()
    if _face_recognition_state == "ok":
        return _encode_face_recognition(image_rgb, num_jitters=num_jitters, model=model)

    _resolve_insightface()
    if _insightface_state == "ok":
        return _encode_insightface(image_rgb)
    if _insightface_state == "failed":
        detail = (_insightface_error or "").strip()
        msg = (
            "Não foi possível carregar o motor InsightFace."
            + (f" Detalhe: {detail}" if detail else "")
        )
        return EncodeResult(False, None, [], msg)

    return EncodeResult(False, None, [], FACE_ENGINE_INSTALL_MSG)


def face_distance(a: np.ndarray, b: np.ndarray) -> float:
    _resolve_face_recognition()
    if _face_recognition_state == "ok":
        return float(_face_recognition_mod.face_distance([a], b)[0])
    from .face_matcher import embedding_distance

    return embedding_distance(a, b)
