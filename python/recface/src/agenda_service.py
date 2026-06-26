"""Agenda fictícia local (JSON)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class AgendaEntry:
    name: str
    time: str
    location: str


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def default_agenda_path() -> Path:
    return _project_root() / "data" / "agenda" / "agenda.json"


def load_agenda(path: Optional[Path] = None) -> List[AgendaEntry]:
    p = path or default_agenda_path()
    if not p.exists():
        return []
    with p.open(encoding="utf-8") as f:
        raw = json.load(f)
    out: List[AgendaEntry] = []
    for item in raw:
        out.append(
            AgendaEntry(
                name=str(item.get("name", "")).strip(),
                time=str(item.get("time", "")).strip(),
                location=str(item.get("location", "")).strip(),
            )
        )
    return out


def save_agenda_entries(entries: List[AgendaEntry], path: Optional[Path] = None) -> None:
    p = path or default_agenda_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    raw = [{"name": e.name.strip(), "time": e.time.strip(), "location": e.location.strip()} for e in entries]
    with p.open("w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, indent=2)


def replace_visitor_name_in_agenda(old_name: str, new_name: str, path: Optional[Path] = None) -> int:
    """Atualiza o campo ``name`` onde corresponder (case-insensitive). Retorna quantas linhas foram alteradas."""
    entries = load_agenda(path)
    target_old = old_name.strip().lower()
    new_clean = new_name.strip()
    n = 0
    replaced: List[AgendaEntry] = []
    for e in entries:
        if e.name.strip().lower() == target_old:
            replaced.append(AgendaEntry(new_clean, e.time, e.location))
            n += 1
        else:
            replaced.append(e)
    if n:
        save_agenda_entries(replaced, path)
    return n


def remove_entries_for_visitor_name(name: str, path: Optional[Path] = None) -> int:
    """Remove todos os compromissos cujo nome case-insensitive corresponda. Retorna quantos itens foram removidos."""
    entries = load_agenda(path)
    target = name.strip().lower()
    kept = [e for e in entries if e.name.strip().lower() != target]
    removed = len(entries) - len(kept)
    if removed:
        save_agenda_entries(kept, path)
    return removed


def find_entry_for_name(name: str, agenda: Optional[List[AgendaEntry]] = None) -> Optional[AgendaEntry]:
    agenda = agenda or load_agenda()
    target = name.strip().lower()
    for e in agenda:
        if e.name.strip().lower() == target:
            return e
    return None


def append_entry(
    name: str,
    time: str,
    location: str,
    path: Optional[Path] = None,
) -> None:
    """Acrescenta um compromisso à agenda local (JSON)."""
    p = path or default_agenda_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    entries: List[Dict[str, str]] = []
    if p.exists():
        with p.open(encoding="utf-8") as f:
            raw = json.load(f)
            if isinstance(raw, list):
                entries = list(raw)
    entries.append(
        {
            "name": name.strip(),
            "time": time.strip(),
            "location": location.strip(),
        }
    )
    with p.open("w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
