"""Orquestração: encoding + match + validação + log."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

from . import audit_log, face_encoder, face_matcher, validation_service
from .agenda_service import AgendaEntry


@dataclass
class RecognitionOutcome:
    recognized: bool
    name: Optional[str]
    visitor_id: Optional[str]
    distance: float
    confidence: float
    agenda_entry: Optional[AgendaEntry]
    agenda_valid: bool
    status_message: str


def _load_known_encodings(encodings_dir: Path) -> List[Tuple[str, str, np.ndarray]]:
    encodings_dir = encodings_dir.resolve()
    out: List[Tuple[str, str, np.ndarray]] = []
    if not encodings_dir.exists():
        return out
    for npy in sorted(encodings_dir.glob("*.npy")):
        vid = npy.stem
        meta_path = npy.with_suffix(".json")
        name = vid
        if meta_path.exists():
            import json

            with meta_path.open(encoding="utf-8") as f:
                meta = json.load(f)
            name = str(meta.get("name", vid))
        vec = np.load(npy)
        out.append((vid, name, vec.astype(np.float64)))
    return out


def recognize_from_rgb(
    image_rgb: np.ndarray,
    encodings_dir: Optional[Path] = None,
    threshold: Optional[float] = None,
    reference_now: Optional[datetime] = None,
    tolerance_minutes: int = 90,
) -> RecognitionOutcome:
    root = Path(__file__).resolve().parent.parent
    enc_dir = encodings_dir or (root / "data" / "encodings")

    enc_res = face_encoder.encode_face_from_rgb(image_rgb)
    if not enc_res.ok or enc_res.encoding is None:
        return RecognitionOutcome(
            False,
            None,
            None,
            1.0,
            0.0,
            None,
            False,
            enc_res.message,
        )

    known = _load_known_encodings(enc_dir)
    match = face_matcher.match_encoding(enc_res.encoding, known, threshold=threshold)

    if not match.recognized or match.visitor_name is None:
        return RecognitionOutcome(
            False,
            match.visitor_name,
            match.visitor_id,
            match.distance,
            match.confidence,
            None,
            False,
            "Não reconhecido (distância acima do limiar).",
        )

    val = validation_service.validate_agenda_for_visitor(
        match.visitor_name,
        now=reference_now,
        tolerance_minutes=tolerance_minutes,
    )
    status = "Presença confirmada" if val.ok else "Reconhecido, agenda não validada"
    msg = f"{match.visitor_name} reconhecido. {val.message}"

    return RecognitionOutcome(
        True,
        match.visitor_name,
        match.visitor_id,
        match.distance,
        match.confidence,
        val.entry,
        val.ok,
        msg,
    )


def log_outcome(
    outcome: RecognitionOutcome,
    reference_time_note: str = "",
) -> None:
    if not outcome.recognized or not outcome.name:
        return
    entry = outcome.agenda_entry
    audit_log.append_record(
        audit_log.AttendanceRecord(
            visitor=outcome.name,
            scheduled_time=entry.time if entry else "",
            score=round(outcome.confidence, 4),
            distance=round(outcome.distance, 4),
            timestamp=datetime.now().isoformat(timespec="seconds"),
            status="Presença confirmada" if outcome.agenda_valid else "Agenda divergente",
            location=entry.location if entry else "",
            agenda_valid=outcome.agenda_valid,
            reference_time_note=reference_time_note or "",
        )
    )
