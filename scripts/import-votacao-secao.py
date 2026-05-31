#!/usr/bin/env python3
"""
Importa CSV bweb (votação por seção TSE) para Supabase.

Mesmas tabelas votacao_secao_local + votacao_secao_voto, filtradas por ano_eleicao.

Uso:
  pip install supabase
  python scripts/import-votacao-secao.py --ano 2024
  python scripts/import-votacao-secao.py --ano 2022
  python scripts/import-votacao-secao.py --ano 2022 --continue

Arquivos esperados na raiz:
  votacao_secao_2024_PI.csv
  votacao_secao_2022_PI.csv

Requer .env.local:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Callable, TypeVar

ROOT = Path(__file__).resolve().parent.parent
SG_UF = "PI"
NR_TURNO = 1
BATCH_SIZE = 500
MAX_RETRIES = 8
RETRY_BASE_SECONDS = 5

T = TypeVar("T")


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


def log(msg: str) -> None:
    print(msg, flush=True)


def execute_with_retry(label: str, fn: Callable[[], T]) -> T:
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 — retry em falhas de rede/timeout
            last_error = exc
            if attempt >= MAX_RETRIES:
                break
            wait = RETRY_BASE_SECONDS * attempt
            log(f"  {label} falhou (tentativa {attempt}/{MAX_RETRIES}): {exc}")
            log(f"  aguardando {wait}s…")
            time.sleep(wait)
    raise last_error  # type: ignore[misc]


def local_key(
    municipio_chave: str,
    nr_zona: int,
    nr_secao: int,
    nr_local: int,
) -> tuple[str, int, int, int]:
    return (municipio_chave, nr_zona, nr_secao, nr_local)


def fetch_locais_map(supabase, ano: int) -> dict[tuple, str]:
    locais: dict[tuple, str] = {}
    offset = 0
    page = 1000
    while True:
        result = execute_with_retry(
            f"buscar locais {ano} offset {offset}",
            lambda offset=offset: (
                supabase.table("votacao_secao_local")
                .select("id,municipio_chave,nr_zona,nr_secao,nr_local_votacao")
                .eq("ano_eleicao", ano)
                .range(offset, offset + page - 1)
                .execute()
            ),
        )
        batch = result.data
        if not batch:
            break
        for row in batch:
            key = local_key(
                row["municipio_chave"],
                row["nr_zona"],
                row["nr_secao"],
                row.get("nr_local_votacao") or 0,
            )
            locais[key] = row["id"]
        if len(batch) < page:
            break
        offset += page
    return locais


def fetch_local_ids(supabase, ano: int) -> list[str]:
    ids: list[str] = []
    offset = 0
    page = 1000
    while True:
        result = execute_with_retry(
            f"buscar ids {ano} offset {offset}",
            lambda offset=offset: (
                supabase.table("votacao_secao_local")
                .select("id")
                .eq("ano_eleicao", ano)
                .range(offset, offset + page - 1)
                .execute()
            ),
        )
        batch = [row["id"] for row in result.data]
        if not batch:
            break
        ids.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return ids


def delete_ano(supabase, ano: int) -> None:
    local_ids = fetch_local_ids(supabase, ano)
    if not local_ids:
        log(f"Nenhum dado anterior para {ano}.")
        return

    log(f"Limpando dados anteriores ({ano}) · {len(local_ids)} locais…")
    total_votos_lotes = (len(local_ids) + 99) // 100
    for i, chunk in enumerate(chunked(local_ids, 100), start=1):
        execute_with_retry(
            f"remover votos lote {i}",
            lambda chunk=chunk: supabase.table("votacao_secao_voto").delete().in_("local_id", chunk).execute(),
        )
        if i == 1 or i % 20 == 0 or i == total_votos_lotes:
            log(f"  votos removidos lote {i}/{total_votos_lotes}")

    total_locais_lotes = (len(local_ids) + 199) // 200
    for i, chunk in enumerate(chunked(local_ids, 200), start=1):
        execute_with_retry(
            f"remover locais lote {i}",
            lambda chunk=chunk: supabase.table("votacao_secao_local").delete().in_("id", chunk).execute(),
        )
        if i == 1 or i % 10 == 0 or i == total_locais_lotes:
            log(f"  locais removidos lote {i}/{total_locais_lotes}")


def normalize_ds_cargo(value: str) -> str:
    """TSE bweb 2022 (geral) usa MAIÚSCULAS; 2024 (municipal) já vem capitalizado."""
    texto = (value or "").strip()
    if not texto:
        return texto
    if texto.isupper():
        return texto.title()
    return texto


def csv_path_for_ano(ano: int) -> Path:
    return ROOT / f"votacao_secao_{ano}_PI.csv"


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa votação por seção TSE (PI) para Supabase")
    parser.add_argument("--ano", type=int, required=True, choices=[2022, 2024])
    parser.add_argument(
        "--continue",
        dest="continuar",
        action="store_true",
        help="Retoma inserção de votos usando locais já existentes no Supabase",
    )
    args = parser.parse_args()
    ano = args.ano
    continuar = args.continuar
    csv_path = csv_path_for_ano(ano)

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

    if not csv_path.exists():
        print(f"Arquivo não encontrado: {csv_path}")
        sys.exit(1)

    supabase = create_client(url, key)

    log(f"Importando {ano} · {csv_path.name}" + (" (continuar)" if continuar else ""))
    locais_map: dict[tuple, dict] = {}
    locais_existentes: dict[tuple, str] = {}
    if continuar:
        locais_existentes = fetch_locais_map(supabase, ano)
        if not locais_existentes:
            log(f"Nenhum local encontrado para {ano}. Rode sem --continue.")
            sys.exit(1)
        log(f"Locais existentes no Supabase: {len(locais_existentes)}")

    votos_rows: list[dict] = []
    total_linhas = 0
    cargos: set[str] = set()
    locais_sem_match = 0

    with csv_path.open(newline="", encoding="latin-1") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            total_linhas += 1
            nm_municipio = (row.get("NM_MUNICIPIO") or row.get("NM_UE") or "").strip()
            if not nm_municipio:
                continue

            ds_cargo = normalize_ds_cargo(row.get("DS_CARGO") or "")
            if ds_cargo:
                cargos.add(ds_cargo)

            municipio_chave = normalize_municipio_chave(nm_municipio)
            nr_zona = parse_int(row.get("NR_ZONA"))
            nr_secao = parse_int(row.get("NR_SECAO"))
            nr_local = parse_int(row.get("NR_LOCAL_VOTACAO"))
            key = local_key(municipio_chave, nr_zona, nr_secao, nr_local)

            if continuar:
                local_id = locais_existentes.get(key)
                if not local_id:
                    locais_sem_match += 1
                    continue
            else:
                if key not in locais_map:
                    locais_map[key] = {
                        "id": str(uuid.uuid4()),
                        "ano_eleicao": ano,
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
                local_id = locais_map[key]["id"]

            votos_rows.append(
                {
                    "local_id": local_id,
                    "cd_cargo": parse_int(row.get("CD_CARGO")),
                    "ds_cargo": ds_cargo,
                    "nr_votavel": parse_int(row.get("NR_VOTAVEL")),
                    "nm_votavel": (row.get("NM_VOTAVEL") or "").strip(),
                    "sq_candidato": parse_bigint_or_none(row.get("SQ_CANDIDATO")),
                    "qt_votos": parse_int(row.get("QT_VOTOS")),
                }
            )

    locais_rows = list(locais_map.values())
    log(f"Linhas CSV: {total_linhas}")
    log(f"Cargos: {', '.join(sorted(cargos))}")
    if continuar:
        log(f"Locais reutilizados: {len(locais_existentes)} · sem match: {locais_sem_match}")
    else:
        log(f"Locais únicos: {len(locais_rows)}")
    log(f"Registros de voto: {len(votos_rows)}")

    if not continuar:
        delete_ano(supabase, ano)

        log("Inserindo locais…")
        for i, chunk in enumerate(chunked(locais_rows, BATCH_SIZE), start=1):
            execute_with_retry(
                f"inserir locais lote {i}",
                lambda chunk=chunk: supabase.table("votacao_secao_local")
                .upsert(
                    chunk,
                    on_conflict="ano_eleicao,nr_turno,municipio_chave,nr_zona,nr_secao,nr_local_votacao",
                )
                .execute(),
            )
            if i % 10 == 0 or i == 1:
                log(f"  locais lote {i}")

    log("Inserindo votos…")
    total_lotes = (len(votos_rows) + BATCH_SIZE - 1) // BATCH_SIZE
    for i, chunk in enumerate(chunked(votos_rows, BATCH_SIZE), start=1):
        execute_with_retry(
            f"inserir votos lote {i}",
            lambda chunk=chunk: supabase.table("votacao_secao_voto")
            .upsert(chunk, on_conflict="local_id,cd_cargo,nr_votavel")
            .execute(),
        )
        if i % 50 == 0 or i == 1 or i == total_lotes:
            log(f"  votos lote {i}/{total_lotes}")

    log("\nImportação concluída.")
    log(f"  Ano: {ano}")
    if not continuar:
        log(f"  Municípios: {len({r['municipio_chave'] for r in locais_rows})}")
        log(f"  Locais: {len(locais_rows)}")
    log(f"  Votos: {len(votos_rows)}")
    log(f"\nPróximo passo: python scripts/enrich-votacao-secao-bairro.py --ano {ano}")


if __name__ == "__main__":
    main()
