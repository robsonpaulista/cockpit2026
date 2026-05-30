#!/usr/bin/env python3
"""
Importa votacao_secao_2024_PI.csv (TSE bweb) para Supabase.

Pipeline:
  CSV TSE → este script → tabelas votacao_secao_local + votacao_secao_voto

Uso:
  pip install supabase
  # Executar database/create-votacao-secao-2024.sql no Supabase antes
  python scripts/import-votacao-secao-2024.py

Requer .env.local:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import csv
import os
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "votacao_secao_2024_PI.csv"
ANO_ELEICAO = 2024
NR_TURNO = 1
SG_UF = "PI"
BATCH_SIZE = 500


def load_env_local() -> None:
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        m = line.strip()
        if not m or m.startswith("#") or "=" not in m:
            continue
        key, value = m.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def normalize_municipio_chave(nome: str) -> str:
    import unicodedata

    texto = unicodedata.normalize("NFD", nome or "")
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = "".join(c for c in texto if c.isalnum() or c.isspace())
    return texto.lower().strip()


def parse_int(value: str | None) -> int:
    if value is None:
        return 0
    s = str(value).strip()
    if not s:
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def parse_int_or_none(value: str | None) -> int | None:
    n = parse_int(value)
    return n if n > 0 else None


def parse_bigint_or_none(value: str | None) -> int | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        return None


def chunked(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main() -> None:
    load_env_local()

    try:
        from supabase import create_client
    except ImportError:
        print("Instale: pip install supabase")
        sys.exit(1)

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local")
        sys.exit(1)

    if not CSV_PATH.exists():
        print(f"Arquivo não encontrado: {CSV_PATH}")
        sys.exit(1)

    supabase = create_client(url, key)

    print("Lendo CSV…")
    locais_map: dict[tuple, dict] = {}
    votos_rows: list[dict] = []
    total_linhas = 0

    with CSV_PATH.open(newline="", encoding="latin-1") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            total_linhas += 1
            nm_municipio = (row.get("NM_MUNICIPIO") or row.get("NM_UE") or "").strip()
            if not nm_municipio:
                continue

            municipio_chave = normalize_municipio_chave(nm_municipio)
            nr_zona = parse_int(row.get("NR_ZONA"))
            nr_secao = parse_int(row.get("NR_SECAO"))
            nr_local = parse_int(row.get("NR_LOCAL_VOTACAO"))
            local_key = (municipio_chave, nr_zona, nr_secao, nr_local)

            if local_key not in locais_map:
                locais_map[local_key] = {
                    "id": str(uuid.uuid4()),
                    "ano_eleicao": ANO_ELEICAO,
                    "nr_turno": NR_TURNO,
                    "sg_uf": SG_UF,
                    "cd_municipio": (row.get("CD_MUNICIPIO") or row.get("SG_UE") or "").strip() or None,
                    "municipio_chave": municipio_chave,
                    "nm_municipio": nm_municipio.title() if nm_municipio.isupper() else nm_municipio,
                    "nr_zona": nr_zona,
                    "nr_secao": nr_secao,
                    "nr_local_votacao": nr_local if nr_local > 0 else None,
                    "nm_local_votacao": (row.get("NM_LOCAL_VOTACAO") or "").strip() or None,
                    "ds_endereco": (row.get("DS_LOCAL_VOTACAO_ENDERECO") or "").strip() or None,
                }

            local_id = locais_map[local_key]["id"]
            votos_rows.append(
                {
                    "local_id": local_id,
                    "cd_cargo": parse_int(row.get("CD_CARGO")),
                    "ds_cargo": (row.get("DS_CARGO") or "").strip(),
                    "nr_votavel": parse_int(row.get("NR_VOTAVEL")),
                    "nm_votavel": (row.get("NM_VOTAVEL") or "").strip(),
                    "sq_candidato": parse_bigint_or_none(row.get("SQ_CANDIDATO")),
                    "qt_votos": parse_int(row.get("QT_VOTOS")),
                }
            )

    locais_rows = list(locais_map.values())
    print(f"Linhas CSV: {total_linhas}")
    print(f"Locais únicos: {len(locais_rows)}")
    print(f"Registros de voto: {len(votos_rows)}")

    print("Limpando dados anteriores (2024)…")
    supabase.table("votacao_secao_local").delete().eq("ano_eleicao", ANO_ELEICAO).execute()

    print("Inserindo locais…")
    for i, chunk in enumerate(chunked(locais_rows, BATCH_SIZE), start=1):
        supabase.table("votacao_secao_local").upsert(
            chunk,
            on_conflict="ano_eleicao,nr_turno,municipio_chave,nr_zona,nr_secao,nr_local_votacao",
        ).execute()
        print(f"  locais lote {i}")

    print("Inserindo votos…")
    for i, chunk in enumerate(chunked(votos_rows, BATCH_SIZE), start=1):
        supabase.table("votacao_secao_voto").upsert(
            chunk,
            on_conflict="local_id,cd_cargo,nr_votavel",
        ).execute()
        if i % 20 == 0 or i == 1:
            print(f"  votos lote {i} ({min(i * BATCH_SIZE, len(votos_rows))}/{len(votos_rows)})")

    print("\nImportação concluída.")
    print(f"  Municípios: {len({r['municipio_chave'] for r in locais_rows})}")
    print(f"  Locais: {len(locais_rows)}")
    print(f"  Votos: {len(votos_rows)}")


if __name__ == "__main__":
    main()
