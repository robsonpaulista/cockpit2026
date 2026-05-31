#!/usr/bin/env python3
"""Atalho: importa votação por seção 2024. Prefira: python scripts/import-votacao-secao.py --ano 2024"""

import subprocess
import sys

if __name__ == "__main__":
    sys.exit(subprocess.call([sys.executable, "scripts/import-votacao-secao.py", "--ano", "2024"]))
