#!/usr/bin/env python3
"""
Coleta interesse no Google Trends (pytrends) para candidatos ativos em political_actors.

Uso:
  pip install -r scripts/requirements-trends.txt
  python scripts/collect-google-trends.py
  python scripts/collect-google-trends.py --geo BR-PI --timeframe "today 3-m"

Requer .env.local:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Imprime JSON na última linha (stdout) para consumo pela API Next.js.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
BATCH_SIZE = 5
UPSERT_BATCH = 200


def load_env_local() -> None:
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def emit(result: dict[str, Any]) -> None:
    print(json.dumps(result, ensure_ascii=False))


def fetch_active_actors(supabase: Any) -> list[dict[str, Any]]:
    res = (
        supabase.table("political_actors")
        .select("id, name, slug, active")
        .eq("active", True)
        .order("name")
        .execute()
    )
    return res.data or []


def upsert_rows(supabase: Any, rows: list[dict[str, Any]]) -> int:
    total = 0
    for i in range(0, len(rows), UPSERT_BATCH):
        chunk = rows[i : i + UPSERT_BATCH]
        supabase.table("google_trends_interest").upsert(
            chunk,
            on_conflict="search_term,interest_date,geo,timeframe",
        ).execute()
        total += len(chunk)
    return total


def collect_batch(
    pytrends: Any,
    terms: list[str],
    term_to_politico: dict[str, str],
    timeframe: str,
    geo: str,
) -> list[dict[str, Any]]:
    pytrends.build_payload(terms, timeframe=timeframe, geo=geo)
    df = pytrends.interest_over_time()
    if df is None or df.empty:
        return []

    if "isPartial" in df.columns:
        df = df.drop(columns=["isPartial"])

    rows: list[dict[str, Any]] = []
    collected_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    for idx, row in df.iterrows():
        interest_date = idx.date() if hasattr(idx, "date") else date.fromisoformat(str(idx)[:10])
        for term in terms:
            if term not in df.columns:
                continue
            score = int(row[term]) if row[term] == row[term] else 0  # NaN check
            rows.append(
                {
                    "politico_id": term_to_politico.get(term),
                    "search_term": term,
                    "interest_date": interest_date.isoformat(),
                    "interest_score": max(0, min(100, score)),
                    "geo": geo,
                    "timeframe": timeframe,
                    "collected_at": collected_at,
                }
            )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Coleta Google Trends para political_actors")
    parser.add_argument("--geo", default="BR-PI", help="Região Google Trends (ex.: BR-PI, BR)")
    parser.add_argument("--timeframe", default="today 3-m", help='Janela pytrends (ex.: "today 3-m")')
    args = parser.parse_args()

    load_env_local()

    try:
        from pytrends.request import TrendReq
        from supabase import create_client
    except ImportError as exc:
        emit(
            {
                "ok": False,
                "error": "Dependências ausentes. Rode: pip install -r scripts/requirements-trends.txt",
                "detail": str(exc),
            }
        )
        sys.exit(1)

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        emit({"ok": False, "error": "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local"})
        sys.exit(1)

    supabase = create_client(url, key)

    try:
        actors = fetch_active_actors(supabase)
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "does not exist" in msg or "42P01" in msg:
            emit({"ok": False, "error": "Tabelas ausentes. Execute database/create-google-trends-tables.sql", "setupRequired": True})
            sys.exit(1)
        emit({"ok": False, "error": msg})
        sys.exit(1)

    if not actors:
        emit({"ok": True, "terms": 0, "rowsUpserted": 0, "geo": args.geo, "timeframe": args.timeframe})
        return

    term_to_politico = {a["name"]: a["id"] for a in actors}
    terms = [a["name"] for a in actors]

    pytrends = TrendReq(hl="pt-BR", tz=180, retries=2, backoff_factor=0.5)
    all_rows: list[dict[str, Any]] = []
    errors: list[str] = []

    for i in range(0, len(terms), BATCH_SIZE):
        batch = terms[i : i + BATCH_SIZE]
        try:
            all_rows.extend(
                collect_batch(pytrends, batch, term_to_politico, args.timeframe, args.geo)
            )
            if i + BATCH_SIZE < len(terms):
                time.sleep(2)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{', '.join(batch)}: {exc}")

    rows_upserted = 0
    if all_rows:
        try:
            rows_upserted = upsert_rows(supabase, all_rows)
        except Exception as exc:  # noqa: BLE001
            msg = str(exc)
            if "does not exist" in msg or "42P01" in msg:
                emit({"ok": False, "error": "Tabela google_trends_interest ausente.", "setupRequired": True})
                sys.exit(1)
            emit({"ok": False, "error": msg})
            sys.exit(1)

    emit(
        {
            "ok": True,
            "terms": len(terms),
            "rowsUpserted": rows_upserted,
            "geo": args.geo,
            "timeframe": args.timeframe,
            "errors": errors,
        }
    )


if __name__ == "__main__":
    main()
