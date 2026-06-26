"""Validação de agenda em relação ao horário atual (janela tolerada)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, time as dtime
from typing import Optional, Tuple

from .agenda_service import AgendaEntry, find_entry_for_name, load_agenda


@dataclass
class ValidationResult:
    ok: bool
    message: str
    entry: Optional[AgendaEntry]


def _parse_hh_mm(value: str) -> Optional[Tuple[int, int]]:
    value = value.strip()
    for sep in (":", "h", "H"):
        if sep in value and sep != ":":
            value = value.replace(sep, ":")
            break
    parts = value.replace(" ", "").split(":")
    if len(parts) < 2:
        return None
    try:
        h = int(parts[0])
        m = int(parts[1])
        return h, m
    except ValueError:
        return None


def parse_schedule_time(value: str) -> Optional[Tuple[int, int]]:
    """Interpreta horário textual da agenda (ex.: ``10:30``, ``10h30``) como ``(hora, minuto)``."""
    return _parse_hh_mm(value)


def minutes_from_scheduled(reference: datetime, scheduled: dtime) -> int:
    """
    Menor distância em minutos entre o instante de referência e o horário
    agendado, considerando o mesmo dia e os dias adjacentes (atravessa meia-noite).
    """
    best: Optional[int] = None
    for delta in (-1, 0, 1):
        day = reference.date() + timedelta(days=delta)
        candidate = datetime.combine(day, scheduled)
        diff = int(abs((reference - candidate).total_seconds()) // 60)
        if best is None or diff < best:
            best = diff
    return int(best)


def validate_agenda_for_visitor(
    visitor_name: str,
    now: Optional[datetime] = None,
    tolerance_minutes: int = 90,
) -> ValidationResult:
    """
    Confirma se existe entrada de agenda para o nome e se o horário atual
    está dentro da tolerância em relação ao horário agendado.
    """
    entry = find_entry_for_name(visitor_name)
    if entry is None:
        return ValidationResult(
            False,
            "Nenhuma entrada de agenda encontrada para este visitante.",
            None,
        )

    parsed = _parse_hh_mm(entry.time)
    if parsed is None:
        return ValidationResult(
            False,
            f"Horário da agenda inválido: {entry.time}",
            entry,
        )

    h, m = parsed
    scheduled = dtime(hour=h, minute=m)
    reference = now or datetime.now()
    diff = minutes_from_scheduled(reference, scheduled)
    clock = reference.strftime("%d/%m/%Y %H:%M")
    clock_kind = "relógio simulado" if now is not None else "relógio do sistema"

    if diff <= tolerance_minutes:
        return ValidationResult(
            True,
            f"Dentro da janela ({entry.time}, ±{tolerance_minutes} min). "
            f"{clock_kind}: {clock}.",
            entry,
        )

    return ValidationResult(
        False,
        f"Fora da janela (±{tolerance_minutes} min): agendado {entry.time}; "
        f"{clock_kind}: {clock}.",
        entry,
    )


def list_agenda_display() -> str:
    lines = []
    for e in load_agenda():
        lines.append(f"• {e.name} — {e.time} — {e.location}")
    return "\n".join(lines) if lines else "(agenda vazia)"
