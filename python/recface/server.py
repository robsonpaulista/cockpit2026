"""
Motor de reconhecimento facial para o Cockpit 2026.
Expõe encoding/matching InsightFace; cadastro de pessoas fica no Supabase (Next.js).
"""

from __future__ import annotations

import base64
import io
import json
from datetime import datetime
from typing import Any, Optional

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import os

from src import (
    agenda_service,
    audit_log,
    face_capture,
    face_encoder,
    face_matcher,
    image_processing_lab,
    recognition_service,
    validation_service,
    visitor_storage,
)

app = FastAPI(title="Cockpit Recface Engine", version="1.0.0")

_cors_origins = [
  o.strip()
  for o in os.getenv(
    "RECFACE_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
  ).split(",")
  if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _rgb_from_base64(data: str) -> np.ndarray:
    payload = data.split(",", 1)[-1] if "," in data else data
    raw = base64.b64decode(payload)
    return _rgb_from_bytes(raw)


def _rgb_from_bytes(raw: bytes) -> np.ndarray:
    if not raw:
        raise HTTPException(422, "Imagem vazia ou corrompida.")
    try:
        return face_capture.pil_image_to_rgb_array(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(422, f"Imagem inválida ou corrompida: {exc}") from exc


def _rgb_from_upload(file: UploadFile) -> np.ndarray:
    raw = file.file.read()
    return _rgb_from_bytes(raw)


class AgendaEntryBody(BaseModel):
    name: str
    time: str
    location: str


class SaveAgendaBody(BaseModel):
    entries: list[AgendaEntryBody]


class UpdateNameBody(BaseModel):
    name: str


class RecognizeBody(BaseModel):
    imageBase64: str
    threshold: Optional[float] = None
    toleranceMinutes: int = 90
    referenceNow: Optional[str] = None
    log: bool = False
    referenceTimeNote: str = ""


class MetricsBody(BaseModel):
    rows: list[dict[str, str]]


class ImageLabBody(BaseModel):
    imageBase64: str
    operation: str


def _outcome_to_dict(outcome: recognition_service.RecognitionOutcome) -> dict[str, Any]:
    entry = outcome.agenda_entry
    return {
        "recognized": outcome.recognized,
        "name": outcome.name,
        "visitorId": outcome.visitor_id,
        "distance": outcome.distance,
        "confidence": outcome.confidence,
        "agendaValid": outcome.agenda_valid,
        "statusMessage": outcome.status_message,
        "agendaEntry": (
            {"name": entry.name, "time": entry.time, "location": entry.location} if entry else None
        ),
    }


class MatchKnownBody(BaseModel):
    imageBase64: str
    known: list[dict[str, Any]]
    threshold: Optional[float] = None


def _bbox_from_location(loc: tuple[int, int, int, int]) -> dict[str, int]:
    top, right, bottom, left = loc
    return {"x": left, "y": top, "width": right - left, "height": bottom - top}


@app.post("/encode")
async def encode_face(image: UploadFile = File(...)) -> dict[str, Any]:
    """Extrai embedding facial — usado pelo cadastro de pessoas no Cockpit."""
    if not face_encoder.face_engine_available():
        raise HTTPException(503, face_encoder.insightface_init_error() or "Motor facial indisponível")

    rgb = _rgb_from_upload(image)
    enc = face_encoder.encode_face_from_rgb(rgb)
    if not enc.ok or enc.encoding is None:
        raise HTTPException(422, enc.message)

    bbox = None
    if enc.face_locations:
        bbox = _bbox_from_location(enc.face_locations[0])

    vec = enc.encoding.astype(np.float64)
    return {
        "vector": vec.tolist(),
        "dimensions": int(vec.shape[0]),
        "boundingBox": bbox,
        "message": enc.message,
    }


@app.post("/encode/base64")
def encode_face_base64(body: RecognizeBody) -> dict[str, Any]:
    if not face_encoder.face_engine_available():
        raise HTTPException(503, "Motor facial indisponível")

    rgb = _rgb_from_base64(body.imageBase64)
    enc = face_encoder.encode_face_from_rgb(rgb)
    if not enc.ok or enc.encoding is None:
        raise HTTPException(422, enc.message)

    bbox = _bbox_from_location(enc.face_locations[0]) if enc.face_locations else None
    vec = enc.encoding.astype(np.float64)
    return {
        "vector": vec.tolist(),
        "dimensions": int(vec.shape[0]),
        "boundingBox": bbox,
        "message": enc.message,
    }


@app.post("/match-all")
def match_all_known_faces(body: MatchKnownBody) -> dict[str, Any]:
    """Detecta todos os rostos e identifica cada um contra a base cadastrada."""
    if not face_encoder.face_engine_available():
        raise HTTPException(503, "Motor facial indisponível")

    rgb = _rgb_from_base64(body.imageBase64)
    detected = face_encoder.encode_all_faces_from_rgb(rgb)
    if not detected.ok or not detected.faces:
        raise HTTPException(422, detected.message)

    known: list[tuple[str, str, np.ndarray]] = []
    for item in body.known:
        pid = str(item.get("personId", item.get("id", "")))
        name = str(item.get("name", pid))
        raw = item.get("vector")
        if not pid or raw is None:
            continue
        known.append((pid, name, np.asarray(raw, dtype=np.float64)))

    matches = face_matcher.match_faces_to_known(
        [face.encoding for face in detected.faces],
        known,
        threshold=body.threshold,
    )

    return {
        "faceCount": len(detected.faces),
        "recognized": len(matches) > 0,
        "matches": [
            {
                "personId": match.person_id,
                "name": match.person_name,
                "distance": match.distance,
                "confidence": match.confidence,
            }
            for match in matches
        ],
    }


@app.post("/match")
def match_known_faces(body: MatchKnownBody) -> dict[str, Any]:
    """Compara rosto na imagem com embeddings cadastrados (personId + vector)."""
    if not face_encoder.face_engine_available():
        raise HTTPException(503, "Motor facial indisponível")

    rgb = _rgb_from_base64(body.imageBase64)
    enc = face_encoder.encode_face_from_rgb(rgb)
    if not enc.ok or enc.encoding is None:
        raise HTTPException(422, enc.message)

    known: list[tuple[str, str, np.ndarray]] = []
    for item in body.known:
        pid = str(item.get("personId", item.get("id", "")))
        name = str(item.get("name", pid))
        raw = item.get("vector")
        if not pid or raw is None:
            continue
        known.append((pid, name, np.asarray(raw, dtype=np.float64)))

    match = face_matcher.match_encoding(enc.encoding, known, threshold=body.threshold)
    return {
        "recognized": match.recognized,
        "personId": match.visitor_id,
        "name": match.visitor_name,
        "distance": match.distance,
        "confidence": match.confidence,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/engine")
def engine_status() -> dict[str, Any]:
    return {
        "available": face_encoder.face_engine_available(),
        "label": face_encoder.active_engine_label(),
        "error": face_encoder.insightface_init_error() or None,
    }


@app.get("/stats")
def stats() -> dict[str, Any]:
    agenda = agenda_service.load_agenda()
    visitors = visitor_storage.list_registered_visitors()
    logs = audit_log.read_records(limit=5000)
    return {
        "visitorsCount": visitor_storage.encoding_count(),
        "agendaCount": len(agenda),
        "logsCount": len(logs),
        "engineAvailable": face_encoder.face_engine_available(),
    }


@app.get("/visitors")
def list_visitors() -> list[dict[str, Any]]:
    return visitor_storage.list_registered_visitors()


@app.get("/visitors/{visitor_id}")
def get_visitor(visitor_id: str) -> dict[str, Any]:
    visitor = visitor_storage.get_visitor(visitor_id)
    if not visitor:
        raise HTTPException(404, "Visitante não encontrado")
    return visitor


@app.post("/visitors")
async def register_visitor(
    name: str = Form(...),
    image: UploadFile = File(...),
) -> dict[str, Any]:
    if not face_encoder.face_engine_available():
        raise HTTPException(503, face_encoder.insightface_init_error() or "Motor facial indisponível")

    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(400, "Informe um nome válido")
    if visitor_storage.visitor_name_exists(clean_name):
        raise HTTPException(409, "Já existe cadastro com esse nome")

    rgb = _rgb_from_upload(image)
    enc = face_encoder.encode_face_from_rgb(rgb)
    if not enc.ok or enc.encoding is None:
        raise HTTPException(422, enc.message)

    visitor_id = visitor_storage.register_visitor(clean_name, enc.encoding)
    try:
        visitor_storage.save_registration_capture(visitor_id, rgb)
    except Exception as exc:  # noqa: BLE001
        return {
            "id": visitor_id,
            "name": clean_name,
            "warning": f"Cadastro gravado, mas foto não salva: {exc}",
        }

    return {"id": visitor_id, "name": clean_name}


@app.put("/visitors/{visitor_id}/name")
def update_visitor_name(visitor_id: str, body: UpdateNameBody) -> dict[str, str]:
    old = visitor_storage.get_visitor(visitor_id)
    if not old:
        raise HTTPException(404, "Visitante não encontrado")

    ok, msg = visitor_storage.update_visitor_name(visitor_id, body.name)
    if not ok:
        raise HTTPException(400, msg)

    old_name = str(old.get("name", ""))
    agenda_service.replace_visitor_name_in_agenda(old_name, body.name.strip())
    return {"message": msg}


@app.put("/visitors/{visitor_id}/face")
async def update_visitor_face(
    visitor_id: str,
    image: UploadFile = File(...),
) -> dict[str, str]:
    if not face_encoder.face_engine_available():
        raise HTTPException(503, "Motor facial indisponível")

    rgb = _rgb_from_upload(image)
    enc = face_encoder.encode_face_from_rgb(rgb)
    if not enc.ok or enc.encoding is None:
        raise HTTPException(422, enc.message)

    ok, msg = visitor_storage.update_visitor_face(visitor_id, enc.encoding, capture_rgb=rgb)
    if not ok:
        raise HTTPException(400, msg)
    return {"message": msg}


@app.delete("/visitors/{visitor_id}")
def delete_visitor(visitor_id: str) -> dict[str, str]:
    visitor = visitor_storage.get_visitor(visitor_id)
    if not visitor:
        raise HTTPException(404, "Visitante não encontrado")

    name = str(visitor.get("name", ""))
    visitor_storage.delete_visitor(visitor_id)
    removed = agenda_service.remove_entries_for_visitor_name(name)
    return {"message": f"Visitante removido. {removed} compromisso(s) da agenda excluído(s)."}


@app.get("/visitors/{visitor_id}/capture")
def visitor_capture_info(visitor_id: str) -> dict[str, Any]:
    path = visitor_storage.registration_capture_path(visitor_id)
    return {"hasCapture": path is not None, "path": str(path) if path else None}


@app.get("/agenda")
def get_agenda() -> list[dict[str, str]]:
    return [
        {"name": e.name, "time": e.time, "location": e.location}
        for e in agenda_service.load_agenda()
    ]


@app.get("/agenda/with-presence")
def agenda_with_presence() -> list[dict[str, str]]:
    entries = agenda_service.load_agenda()
    return audit_log.agenda_rows_with_presence(entries)


@app.post("/agenda")
def append_agenda_entry(body: AgendaEntryBody) -> dict[str, str]:
    name = body.name.strip()
    visitors = visitor_storage.list_registered_visitors()
    if not any(str(v.get("name", "")).strip().lower() == name.lower() for v in visitors):
        raise HTTPException(400, "Cadastre o visitante antes de incluir na agenda")

    agenda_service.append_entry(body.name, body.time, body.location)
    return {"message": "Compromisso incluído na agenda"}


@app.put("/agenda")
def save_agenda(body: SaveAgendaBody) -> dict[str, str]:
    entries = [
        agenda_service.AgendaEntry(e.name.strip(), e.time.strip(), e.location.strip())
        for e in body.entries
    ]
    agenda_service.save_agenda_entries(entries)
    return {"message": f"Agenda salva com {len(entries)} compromisso(s)"}


@app.delete("/agenda/{name}")
def remove_agenda_for_name(name: str) -> dict[str, str]:
    removed = agenda_service.remove_entries_for_visitor_name(name)
    return {"message": f"{removed} compromisso(s) removido(s)"}


@app.post("/recognize")
def recognize(body: RecognizeBody) -> dict[str, Any]:
    if not face_encoder.face_engine_available():
        raise HTTPException(503, "Motor facial indisponível")

    rgb = _rgb_from_base64(body.imageBase64)
    ref_now = None
    if body.referenceNow:
        try:
            ref_now = datetime.fromisoformat(body.referenceNow)
        except ValueError as exc:
            raise HTTPException(400, "referenceNow inválido") from exc

    outcome = recognition_service.recognize_from_rgb(
        rgb,
        threshold=body.threshold,
        reference_now=ref_now,
        tolerance_minutes=body.toleranceMinutes,
    )

    if body.log and outcome.recognized:
        recognition_service.log_outcome(outcome, reference_time_note=body.referenceTimeNote)

    return _outcome_to_dict(outcome)


@app.post("/recognize/upload")
async def recognize_upload(
    image: UploadFile = File(...),
    threshold: Optional[float] = Form(None),
    tolerance_minutes: int = Form(90),
    log: bool = Form(False),
) -> dict[str, Any]:
    if not face_encoder.face_engine_available():
        raise HTTPException(503, "Motor facial indisponível")

    rgb = _rgb_from_upload(image)
    outcome = recognition_service.recognize_from_rgb(
        rgb,
        threshold=threshold,
        tolerance_minutes=tolerance_minutes,
    )
    if log and outcome.recognized:
        recognition_service.log_outcome(outcome)
    return _outcome_to_dict(outcome)


@app.get("/logs")
def get_logs(limit: int = 500) -> list[dict[str, Any]]:
    return audit_log.read_records(limit=limit)


@app.post("/metrics/classification")
def compute_metrics(body: MetricsBody) -> dict[str, Any]:
    try:
        import pandas as pd
        from src import classification_metrics
    except ImportError as exc:
        raise HTTPException(
            503,
            "Módulo acadêmico indisponível (instale pandas e scikit-learn).",
        ) from exc

    df = pd.DataFrame(body.rows)
    result, err = classification_metrics.compute_classification_metrics(df)
    if err or result is None:
        raise HTTPException(400, err or "Falha ao calcular métricas")

    return {
        "accuracy": result.accuracy,
        "precisionMacro": result.precision_macro,
        "recallMacro": result.recall_macro,
        "f1Macro": result.f1_macro,
        "f1Weighted": result.f1_weighted,
        "labels": result.labels,
        "confusion": result.confusion.tolist(),
        "reportText": result.report_text,
    }


@app.post("/image/lab")
def image_lab(body: ImageLabBody) -> dict[str, Any]:
    rgb = _rgb_from_base64(body.imageBase64)
    op = body.operation.strip().lower()

    op_map = {
        "grayscale": "cinza",
        "cinza": "cinza",
        "blur": "gaussian",
        "gaussian": "gaussian",
        "edges": "canny",
        "canny": "canny",
        "equalize": "histograma_cinza",
        "histograma_cinza": "histograma_cinza",
        "otsu": "otsu_contornos",
        "otsu_contornos": "otsu_contornos",
        "sobel": "sobel",
    }
    mapped = op_map.get(op)
    if mapped is None:
        raise HTTPException(400, f"Operação desconhecida: {body.operation}")

    step = image_processing_lab.run_operation(rgb, mapped)  # type: ignore[arg-type]
    from PIL import Image

    pil = Image.fromarray(np.clip(step.image_rgb, 0, 255).astype(np.uint8))
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=90)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return {
        "imageBase64": f"data:image/jpeg;base64,{b64}",
        "operation": mapped,
        "title": step.title,
        "description": step.description,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="127.0.0.1", port=8502, reload=False)
