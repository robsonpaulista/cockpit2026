"""Persistência de visitantes e embeddings no disco local."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np


def _root() -> Path:
    return Path(__file__).resolve().parent.parent


def register_visitor(name: str, encoding: np.ndarray) -> str:
    """Salva encoding (.npy) e metadados do visitante (sem agenda — agenda é outro passo)."""
    visitor_id = str(uuid.uuid4())
    enc_dir = _root() / "data" / "encodings"
    vis_dir = _root() / "data" / "visitors"
    enc_dir.mkdir(parents=True, exist_ok=True)
    vis_dir.mkdir(parents=True, exist_ok=True)

    np.save(enc_dir / f"{visitor_id}.npy", encoding.astype(np.float64))
    meta: Dict[str, Any] = {
        "id": visitor_id,
        "name": name.strip(),
        "registered_at": datetime.now().isoformat(timespec="seconds"),
    }
    for path in (enc_dir / f"{visitor_id}.json", vis_dir / f"{visitor_id}.json"):
        with path.open("w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

    return visitor_id


def captures_dir() -> Path:
    """Fotos de referência gravadas junto ao cadastro (para laboratório / auditoria local)."""
    d = _root() / "data" / "captures"
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_registration_capture(visitor_id: str, rgb: np.ndarray) -> Path:
    """
    Salva a imagem usada no cadastro como ``{visitor_id}.jpg`` em ``data/captures/``.
    Atualiza os metadados do visitante com o nome do arquivo.
    """
    import cv2

    enc_dir = _root() / "data" / "encodings"
    vis_dir = _root() / "data" / "visitors"
    rgb_u8 = np.clip(np.asarray(rgb), 0, 255).astype(np.uint8)
    bgr = cv2.cvtColor(rgb_u8, cv2.COLOR_RGB2BGR)
    cap_path = captures_dir() / f"{visitor_id}.jpg"
    cv2.imwrite(str(cap_path), bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 92])

    fname = cap_path.name
    for base in (enc_dir, vis_dir):
        meta_path = base / f"{visitor_id}.json"
        if meta_path.exists():
            with meta_path.open(encoding="utf-8") as f:
                meta = json.load(f)
            meta["registration_capture"] = fname
            with meta_path.open("w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)

    return cap_path


def list_registration_captures() -> List[Dict[str, Any]]:
    """
    Lista JPEG em ``data/captures/`` com nome amigável do visitante (quando cadastrado).
    Ordena por nome de exibição.
    """
    cap_dir = captures_dir()
    if not cap_dir.exists():
        return []
    by_id = {str(v.get("id")): v for v in list_registered_visitors()}
    rows: List[Dict[str, Any]] = []
    for p in sorted(cap_dir.glob("*.jpg")):
        vid = p.stem
        v = by_id.get(vid, {})
        display = str(v.get("name", vid))
        rows.append(
            {
                "visitor_id": vid,
                "name": display,
                "path": p.resolve(),
                "label": f"{display} ({vid[:8]}…)",
            }
        )
    rows.sort(key=lambda r: (r["name"].lower(), r["visitor_id"]))
    return rows


def registration_capture_path(visitor_id: str) -> Optional[Path]:
    p = captures_dir() / f"{visitor_id}.jpg"
    return p if p.is_file() else None


def visitor_name_exists(name: str) -> bool:
    return visitor_name_taken(name, exclude_visitor_id=None)


def visitor_name_taken(name: str, exclude_visitor_id: Optional[str] = None) -> bool:
    target = name.strip().lower()
    for v in list_registered_visitors():
        vid = str(v.get("id", ""))
        if exclude_visitor_id and vid == exclude_visitor_id:
            continue
        if str(v.get("name", "")).strip().lower() == target:
            return True
    return False


def get_visitor(visitor_id: str) -> Optional[Dict[str, Any]]:
    p = _root() / "data" / "visitors" / f"{visitor_id}.json"
    if not p.exists():
        return None
    with p.open(encoding="utf-8") as f:
        return json.load(f)


def delete_visitor(visitor_id: str) -> tuple[bool, str]:
    if get_visitor(visitor_id) is None:
        return False, "Visitante não encontrado."

    root = _root()
    paths = [
        root / "data" / "encodings" / f"{visitor_id}.npy",
        root / "data" / "encodings" / f"{visitor_id}.json",
        root / "data" / "visitors" / f"{visitor_id}.json",
        root / "data" / "captures" / f"{visitor_id}.jpg",
    ]
    for fp in paths:
        if fp.exists():
            fp.unlink()
    return True, "Arquivos do visitante removidos."


def update_visitor_name(visitor_id: str, new_name: str) -> tuple[bool, str]:
    new_name = new_name.strip()
    if not new_name:
        return False, "Informe um nome válido."
    if visitor_name_taken(new_name, exclude_visitor_id=visitor_id):
        return False, "Já existe outro cadastro com esse nome."
    if get_visitor(visitor_id) is None:
        return False, "Visitante não encontrado."

    enc_dir = _root() / "data" / "encodings"
    vis_dir = _root() / "data" / "visitors"
    now = datetime.now().isoformat(timespec="seconds")
    for base in (enc_dir, vis_dir):
        meta_path = base / f"{visitor_id}.json"
        if not meta_path.exists():
            continue
        with meta_path.open(encoding="utf-8") as f:
            meta = json.load(f)
        meta["name"] = new_name
        meta["updated_at"] = now
        with meta_path.open("w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
    return True, "Nome atualizado nos metadados."


def update_visitor_face(
    visitor_id: str,
    encoding: np.ndarray,
    capture_rgb: Optional[np.ndarray] = None,
) -> tuple[bool, str]:
    if get_visitor(visitor_id) is None:
        return False, "Visitante não encontrado."

    enc_dir = _root() / "data" / "encodings"
    np.save(enc_dir / f"{visitor_id}.npy", np.asarray(encoding).astype(np.float64))

    vis_dir = _root() / "data" / "visitors"
    now = datetime.now().isoformat(timespec="seconds")
    for base in (enc_dir, vis_dir):
        meta_path = base / f"{visitor_id}.json"
        if not meta_path.exists():
            continue
        with meta_path.open(encoding="utf-8") as f:
            meta = json.load(f)
        meta["face_updated_at"] = now
        with meta_path.open("w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

    if capture_rgb is not None:
        try:
            save_registration_capture(visitor_id, capture_rgb)
        except Exception as exc:  # noqa: BLE001
            return True, f"Embedding atualizado; falha ao salvar JPG: {exc}"
    return True, "Rosto do visitante atualizado (embedding gravado)."


def list_registered_visitors() -> List[Dict[str, Any]]:
    vis_dir = _root() / "data" / "visitors"
    if not vis_dir.exists():
        return []
    out: List[Dict[str, Any]] = []
    for p in sorted(vis_dir.glob("*.json")):
        with p.open(encoding="utf-8") as f:
            out.append(json.load(f))
    return out


def encoding_count() -> int:
    enc_dir = _root() / "data" / "encodings"
    if not enc_dir.exists():
        return 0
    return len(list(enc_dir.glob("*.npy")))
