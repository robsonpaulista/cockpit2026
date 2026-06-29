#!/usr/bin/env python3
"""
Enriquece votacao_secao_local com bairro e endereço oficial do TSE.

Fonte: Eleitorado por local de votação (Sistema ELO)

Uso:
  pip3 install supabase requests
  python3 scripts/enrich-votacao-secao-bairro.py --ano 2024
  python3 scripts/enrich-votacao-secao-bairro.py --ano 2022
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import sys
import time
import unicodedata
import zipfile
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
NR_TURNO = 1
SG_UF = "PI"
BATCH_SIZE = 150
CACHE_DIR = ROOT / ".cache"

ELEITORADO_URLS = {
    2024: "https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2024.zip",
    2022: "https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2022.zip",
}


def cache_zip_path(ano: int) -> Path:
    return CACHE_DIR / f"eleitorado_local_votacao_{ano}.zip"


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


def match_key(municipio_chave: str, nr_zona: int, nr_secao: int, nr_local: int | None) -> tuple:
    return (municipio_chave, nr_zona, nr_secao, nr_local if nr_local and nr_local > 0 else 0)


def ensure_zip(path: Path, url: str) -> Path:
    env_path = os.environ.get("ELEITORADO_LOCAL_ZIP", "").strip()
    if env_path:
        p = Path(env_path)
        if not p.exists():
            print(f"Arquivo não encontrado: {p}")
            sys.exit(1)
        return p

    if path.exists() and path.stat().st_size > 1_000_000:
        print(f"Usando cache: {path}")
        return path

    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Baixando cadastro TSE ({url})…")
    with requests.get(url, stream=True, timeout=600) as resp:
        resp.raise_for_status()
        with path.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
    print(f"Salvo em {path}")
    return path


def parse_float_coord(value: str | None) -> float | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s or s == "-1":
        return None
    try:
        n = float(s.replace(",", "."))
    except ValueError:
        return None
    if not (-180 <= n <= 180):
        return None
    return n


def is_zona_rural(row: dict) -> bool:
    endereco = (row.get("DS_ENDERECO") or "").upper()
    bairro = (row.get("NM_BAIRRO") or "").upper()
    tipo = (row.get("DS_TIPO_LOCAL") or "").upper()
    if "ZONA RURAL" in endereco or "POVOADO" in endereco:
        return True
    if "RURAL" in bairro or "POVOADO" in bairro or "DISTRITO" in bairro:
        return True
    if "RURAL" in tipo:
        return True
    return False


def load_eleitorado_pi(zip_path: Path) -> dict[tuple, dict]:
    cadastro: dict[tuple, dict] = {}
    total_pi = 0

    with zipfile.ZipFile(zip_path) as zf:
        csv_name = next(n for n in zf.namelist() if n.lower().endswith(".csv"))
        with zf.open(csv_name) as raw:
            text = io.TextIOWrapper(raw, encoding="latin-1", newline="")
            for row in csv.DictReader(text, delimiter=";"):
                if (row.get("SG_UF") or "").strip().upper() != SG_UF:
                    continue
                total_pi += 1
                nm_municipio = (row.get("NM_MUNICIPIO") or "").strip()
                if not nm_municipio:
                    continue
                chave = normalize_municipio_chave(nm_municipio)
                nr_zona = parse_int(row.get("NR_ZONA"))
                nr_secao = parse_int(row.get("NR_SECAO"))
                nr_local_raw = parse_int(row.get("NR_LOCAL_VOTACAO"))
                nr_local = nr_local_raw if nr_local_raw > 0 else None
                key = match_key(chave, nr_zona, nr_secao, nr_local)
                cadastro[key] = {
                    "nm_bairro": (row.get("NM_BAIRRO") or "").strip() or None,
                    "ds_endereco": (row.get("DS_ENDERECO") or "").strip() or None,
                    "nm_local_votacao": (row.get("NM_LOCAL_VOTACAO") or "").strip() or None,
                    "qt_eleitores_secao": parse_int(row.get("QT_ELEITOR_SECAO")),
                    "nr_latitude": parse_float_coord(row.get("NR_LATITUDE")),
                    "nr_longitude": parse_float_coord(row.get("NR_LONGITUDE")),
                    "nr_cep": (row.get("NR_CEP") or "").strip() or None,
                    "ds_tipo_local": (row.get("DS_TIPO_LOCAL") or "").strip() or None,
                    "zona_rural": is_zona_rural(row),
                }

    print(f"Cadastro TSE PI: {total_pi} linhas · {len(cadastro)} chaves únicas")
    return cadastro


def fetch_locais(supabase, ano: int) -> list[dict]:
    rows: list[dict] = []
    start = 0
    page = 1000
    while True:
        end = start + page - 1
        resp = (
            supabase.table("votacao_secao_local")
            .select(
                "id, ano_eleicao, nr_turno, sg_uf, cd_municipio, municipio_chave, "
                "nm_municipio, nr_zona, nr_secao, nr_local_votacao, nm_local_votacao, "
                "ds_endereco, nm_bairro, qt_eleitores_secao, nr_latitude, nr_longitude, "
                "nr_cep, ds_tipo_local, zona_rural"
            )
            .eq("ano_eleicao", ano)
            .eq("nr_turno", NR_TURNO)
            .order("id")
            .range(start, end)
            .execute()
        )
        batch = resp.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page:
            break
        start += page
    return rows


def chunked(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def lookup_cadastro(cadastro: dict[tuple, dict], local: dict) -> dict | None:
    chave = str(local["municipio_chave"])
    nr_zona = parse_int(local.get("nr_zona"))
    nr_secao = parse_int(local.get("nr_secao"))
    nr_local_raw = local.get("nr_local_votacao")
    nr_local = parse_int(nr_local_raw) if nr_local_raw is not None else None
    if nr_local is not None and nr_local <= 0:
        nr_local = None

    key = match_key(chave, nr_zona, nr_secao, nr_local)
    hit = cadastro.get(key)
    if hit:
        return hit

    return cadastro.get(match_key(chave, nr_zona, nr_secao, None))


def build_upsert_row(local: dict, hit: dict) -> dict:
    row = {
        "id": local["id"],
        "ano_eleicao": local["ano_eleicao"],
        "nr_turno": local["nr_turno"],
        "sg_uf": local["sg_uf"],
        "cd_municipio": local.get("cd_municipio"),
        "municipio_chave": local["municipio_chave"],
        "nm_municipio": local["nm_municipio"],
        "nr_zona": local["nr_zona"],
        "nr_secao": local["nr_secao"],
        "nr_local_votacao": local.get("nr_local_votacao"),
        "nm_local_votacao": hit.get("nm_local_votacao") or local.get("nm_local_votacao"),
        "ds_endereco": hit.get("ds_endereco") or local.get("ds_endereco"),
        "nm_bairro": hit.get("nm_bairro") or local.get("nm_bairro"),
        "qt_eleitores_secao": hit.get("qt_eleitores_secao") or local.get("qt_eleitores_secao"),
        "nr_latitude": hit.get("nr_latitude") if hit.get("nr_latitude") is not None else local.get("nr_latitude"),
        "nr_longitude": hit.get("nr_longitude") if hit.get("nr_longitude") is not None else local.get("nr_longitude"),
        "nr_cep": hit.get("nr_cep") or local.get("nr_cep"),
        "ds_tipo_local": hit.get("ds_tipo_local") or local.get("ds_tipo_local"),
        "zona_rural": hit.get("zona_rural") if hit.get("zona_rural") is not None else local.get("zona_rural"),
    }
    return row


def upsert_batch(supabase, batch: list[dict], attempt: int = 1) -> None:
    try:
        supabase.table("votacao_secao_local").upsert(batch, on_conflict="id").execute()
    except Exception as exc:
        msg = str(exc)
        if "nm_bairro" in msg and "schema cache" in msg:
            print(
                "\nErro: colunas TSE ausentes. Execute no Supabase SQL Editor:\n"
                "  database/alter-votacao-secao-bairro.sql\n"
                "  database/alter-votacao-secao-eleitorado-geo.sql\n"
            )
            raise
        if attempt < 4 and ("timeout" in msg.lower() or "timed out" in msg.lower()):
            wait = attempt * 2
            print(f"  timeout no lote, tentando de novo em {wait}s…")
            time.sleep(wait)
            upsert_batch(supabase, batch, attempt + 1)
            return
        raise


def needs_enrich(local: dict, force: bool) -> bool:
    if force:
        return True
    if not local.get("nm_bairro"):
        return True
    if local.get("qt_eleitores_secao") is None:
        return True
    if local.get("nr_latitude") is None or local.get("nr_longitude") is None:
        return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Enriquece locais com cadastro TSE (ELO)")
    parser.add_argument("--ano", type=int, required=True, choices=[2022, 2024])
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reaplica cadastro TSE mesmo em registros já enriquecidos",
    )
    args = parser.parse_args()
    ano = args.ano
    force = args.force

    load_env_local()

    try:
        from supabase import create_client
    except ImportError:
        print("Instale: pip install supabase requests")
        sys.exit(1)

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local")
        sys.exit(1)

    zip_path = ensure_zip(cache_zip_path(ano), ELEITORADO_URLS[ano])
    cadastro = load_eleitorado_pi(zip_path)

    supabase = create_client(url, key)
    locais = fetch_locais(supabase, ano)
    print(f"Locais no Supabase ({ano}): {len(locais)}")

    upsert_rows: list[dict] = []
    matched = 0
    sem_bairro = 0
    unmatched = 0
    ja_enriquecidos = 0

    for local in locais:
        if not needs_enrich(local, force):
            ja_enriquecidos += 1
            continue

        hit = lookup_cadastro(cadastro, local)
        if not hit:
            unmatched += 1
            continue

        matched += 1
        if not hit.get("nm_bairro"):
            sem_bairro += 1
        upsert_rows.append(build_upsert_row(local, hit))

    if not upsert_rows:
        print(f"Nada a atualizar. Já enriquecidos: {ja_enriquecidos}. Sem match: {unmatched}.")
        return

    print(
        f"Pendentes: {len(upsert_rows)} · já enriquecidos: {ja_enriquecidos} · "
        f"sem match: {unmatched} · sem bairro no TSE: {sem_bairro}"
    )
    print(f"Atualizando Supabase em lotes de {BATCH_SIZE}…")

    ok = 0
    batches = list(chunked(upsert_rows, BATCH_SIZE))
    for i, batch in enumerate(batches, start=1):
        upsert_batch(supabase, batch)
        ok += len(batch)
        print(f"  lote {i}/{len(batches)} · {ok}/{len(upsert_rows)}")

    print("\nEnriquecimento concluído.")
    print(f"  Atualizados nesta execução: {ok}")
    print(f"  Total já com bairro: {ja_enriquecidos + ok}")
    print(f"  Sem correspondência no cadastro TSE: {unmatched}")


if __name__ == "__main__":
    main()
