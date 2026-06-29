#!/usr/bin/env bash
# Importa votação por seção + enrich bairro/geo no Supabase (PI 2024).
# macOS: use python3 (não existe comando "python" por padrão).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VENV="$ROOT/.venv-scripts"
PY="$VENV/bin/python"

if [[ ! -x "$PY" ]]; then
  echo "Criando ambiente Python (.venv-scripts)…"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q supabase requests
fi

ANO="${1:-2024}"
FORCE="${2:-}"

echo "==> Import votacao_secao (ano $ANO) — pode levar vários minutos"
"$PY" scripts/import-votacao-secao.py --ano "$ANO"

echo "==> Enrich bairro + geo TSE (ano $ANO)"
if [[ "$FORCE" == "--force" ]]; then
  "$PY" scripts/enrich-votacao-secao-bairro.py --ano "$ANO" --force
else
  "$PY" scripts/enrich-votacao-secao-bairro.py --ano "$ANO"
fi

echo "Concluído."
