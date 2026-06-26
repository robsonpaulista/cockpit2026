"""Comparação de embeddings: euclidiana (128-d dlib) ou distância cosseno (InsightFace / não-128)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

# face_recognition / dlib: menor distância euclidiana ≈ mais parecido (README: ≤ 0,45)
DEFAULT_THRESHOLD_DL128 = 0.45
# InsightFace (vetor L2-normalizado): usamos d = 1 − cos θ; empiricamente ~0,35–0,50
DEFAULT_THRESHOLD_ONNX = 0.42

DEFAULT_THRESHOLD = DEFAULT_THRESHOLD_DL128


def embedding_distance(query: np.ndarray, reference: np.ndarray) -> float:
    """
    Distância entre dois descritores do mesmo tipo (mesma dimensionalidade).
    - 128 dim: euclidiana (face_recognition).
    - Demais: assume vetores comparáveis por cosseno após L2-normalizar.
    """
    if query.shape != reference.shape:
        return float("inf")
    d = int(query.shape[0])
    q = query.astype(np.float64)
    r = reference.astype(np.float64)
    if d == 128:
        return float(np.linalg.norm(q - r))
    qn = q / (np.linalg.norm(q) + 1e-12)
    rn = r / (np.linalg.norm(r) + 1e-12)
    cos = float(np.clip(np.dot(qn, rn), -1.0, 1.0))
    return float(max(0.0, 1.0 - cos))


def effective_threshold_for_query(
    query: np.ndarray,
    override: Optional[float],
) -> float:
    if override is not None:
        return override
    if int(query.shape[0]) == 128:
        return DEFAULT_THRESHOLD_DL128
    return DEFAULT_THRESHOLD_ONNX


@dataclass
class MatchResult:
    recognized: bool
    visitor_id: Optional[str]
    visitor_name: Optional[str]
    distance: float
    confidence: float


def _confidence_from_distance(distance: float, threshold: float) -> float:
    """Score simples: 1 perto de 0 distância, tende a 0 acima do threshold."""
    if threshold <= 0:
        return 0.0
    d = min(max(distance, 0.0), threshold)
    return float(1.0 - (d / threshold))


@dataclass
class MatchedPerson:
    person_id: str
    person_name: str
    distance: float
    confidence: float


def match_faces_to_known(
    face_encodings: List[np.ndarray],
    known: List[Tuple[str, str, np.ndarray]],
    threshold: Optional[float] = None,
) -> List[MatchedPerson]:
    """
    Compara cada rosto detectado com a base cadastrada.
    Retorna pessoas distintas reconhecidas (melhor confiança por person_id).
    """
    by_id: dict[str, MatchedPerson] = {}

    for encoding in face_encodings:
        match = match_encoding(encoding, known, threshold)
        if not match.recognized or not match.visitor_id or not match.visitor_name:
            continue

        candidate = MatchedPerson(
            person_id=match.visitor_id,
            person_name=match.visitor_name,
            distance=match.distance,
            confidence=match.confidence,
        )
        existing = by_id.get(match.visitor_id)
        if existing is None or candidate.confidence > existing.confidence:
            by_id[match.visitor_id] = candidate

    return sorted(by_id.values(), key=lambda item: item.confidence, reverse=True)


def match_encoding(
    query: np.ndarray,
    known: List[Tuple[str, str, np.ndarray]],
    threshold: Optional[float] = None,
) -> MatchResult:
    """
    known: lista de (visitor_id, nome_exibição, encoding)
    Retorna o melhor match se distância ≤ threshold (threshold automático por dimensão se None).
    """
    eff_threshold = effective_threshold_for_query(query, threshold)

    if not known:
        return MatchResult(False, None, None, 1.0, 0.0)

    best_id: Optional[str] = None
    best_name: Optional[str] = None
    best_dist = float("inf")

    for vid, name, enc in known:
        dist = embedding_distance(query, enc)
        if dist < best_dist:
            best_dist = dist
            best_id = vid
            best_name = name

    recognized = best_dist <= eff_threshold
    conf = _confidence_from_distance(best_dist, eff_threshold)
    return MatchResult(recognized, best_id, best_name, best_dist, conf)
