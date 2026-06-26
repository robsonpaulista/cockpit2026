"""Registro append-only de presença (JSON Lines)."""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol

from .validation_service import parse_schedule_time


@dataclass
class AttendanceRecord:
    visitor: str
    scheduled_time: str
    score: float
    distance: float
    timestamp: str
    status: str
    location: str
    agenda_valid: bool
    reference_time_note: str = ""


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def default_log_path() -> Path:
    return _project_root() / "data" / "logs" / "attendance.jsonl"


def append_record(record: AttendanceRecord, path: Optional[Path] = None) -> None:
    p = path or default_log_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(asdict(record), ensure_ascii=False)
    with p.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def read_records(limit: int = 500, path: Optional[Path] = None) -> List[Dict[str, Any]]:
    p = path or default_log_path()
    if not p.exists():
        return []
    rows: List[Dict[str, Any]] = []
    with p.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows[-limit:]


class _AgendaRowLite(Protocol):
    name: str
    time: str
    location: str


def log_matches_agenda_row(
    record: Dict[str, Any],
    name: str,
    time_str: str,
    location: str,
    *,
    name_is_unique_on_agenda: bool,
) -> bool:
    """
    Indica se um registro de presença se refere ao compromisso (nome + horário + local).
    Se o log não trouxer horário gravado mas o nome for único na agenda, aceita o vínculo por nome.
    """
    nm = str(record.get("visitor", "") or "").strip().lower()
    if nm != name.strip().lower():
        return False

    st_log_raw = str(record.get("scheduled_time", "") or "").strip()
    key_log = parse_schedule_time(st_log_raw) if st_log_raw else None
    key_row = parse_schedule_time(time_str) if time_str.strip() else None

    if key_log is not None and key_row is not None:
        match_time = key_log == key_row
    elif not st_log_raw and name_is_unique_on_agenda:
        match_time = True
    elif not st_log_raw:
        match_time = False
    else:
        match_time = st_log_raw == time_str.strip()

    if not match_time:
        return False

    loc_log = str(record.get("location", "") or "").strip().lower()
    loc_row = location.strip().lower()
    if loc_row and loc_log and loc_row != loc_log:
        return False
    return True


def pick_latest_matching(
    records: List[Dict[str, Any]],
    name: str,
    time_str: str,
    location: str,
    *,
    name_is_unique_on_agenda: bool,
) -> Optional[Dict[str, Any]]:
    matched = [
        r
        for r in records
        if log_matches_agenda_row(
            r,
            name,
            time_str,
            location,
            name_is_unique_on_agenda=name_is_unique_on_agenda,
        )
    ]
    if not matched:
        return None

    def ts_key(rec: Dict[str, Any]) -> datetime:
        raw = str(rec.get("timestamp", "") or "")
        try:
            parsed = datetime.fromisoformat(raw)
        except ValueError:
            return datetime.min.replace()
        return parsed.replace(tzinfo=None)

    matched.sort(key=ts_key, reverse=True)
    return matched[0]


def format_presence_at_entry(record: Dict[str, Any]) -> str:
    """Texto curto para células da agenda: chegada + status do log."""
    ts_str = str(record.get("timestamp", "") or "")
    status = str(record.get("status", "") or "Reconhecido").strip()

    try:
        dt_event = datetime.fromisoformat(ts_str).replace(tzinfo=None)
    except ValueError:
        base = ts_str[:16] if len(ts_str) >= 16 else ts_str
        return f"{base} — {status}" if base else status

    now = datetime.now()
    elapsed_sec = max(0.0, (now - dt_event).total_seconds())
    minutes = elapsed_sec / 60.0
    clock = dt_event.strftime("%H:%M")
    day_short = dt_event.strftime("%d/%m")

    if minutes < 3:
        return f"Acabou de chegar ({clock}) — {status}"
    if minutes < 60:
        return f"Há ~{int(minutes)} min ({clock}) — {status}"
    if elapsed_sec < 24 * 3600:
        return f"Chegou hoje ({clock}) — {status}"
    return f"{day_short} {clock} — {status}"


def agenda_rows_with_presence(
    entries: List[_AgendaRowLite],
    *,
    records: Optional[List[Dict[str, Any]]] = None,
    read_limit: int = 4000,
) -> List[Dict[str, str]]:
    """
    Linhas prontas para ``DataFrame``: Nome, Horário, Local, Presença na entrada.
    Último reconhecimento que casa com cada compromisso (logs em ``attendance.jsonl``).
    """
    recs = records if records is not None else read_records(limit=read_limit)
    name_counts = Counter(e.name.strip().lower() for e in entries)

    rows: List[Dict[str, str]] = []
    for e in entries:
        uniq = name_counts[e.name.strip().lower()] == 1
        latest = pick_latest_matching(recs, e.name, e.time, e.location, name_is_unique_on_agenda=uniq)
        rows.append(
            {
                "Nome": e.name,
                "Horário": e.time,
                "Local": e.location,
                "Presença na entrada": format_presence_at_entry(latest) if latest else "Sem registro de entrada",
            }
        )
    return rows

