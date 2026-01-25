#!/usr/bin/env python3
"""
Script para corrigir duplicatas de tokens Tailwind
Exemplo: border-border-card-card → border-border-card
"""

import os
import re
from pathlib import Path

# Padrões de duplicação conhecidas
DUPLICATES = {
    'border-border-card-card': 'border-border-card',
    'text-text-primary': 'text-text-primary',
    'text-text-secondary': 'text-text-secondary',
    'text-text-muted': 'text-text-muted',
    'bg-bg-surface': 'bg-bg-surface',
    'bg-bg-app': 'bg-bg-app',
    'bg-bg-sidebar': 'bg-bg-sidebar',
    'text-accent-gold-soft': 'text-accent-gold-soft',
    'text-status-success': 'text-status-success',
    'text-status-warning': 'text-status-warning',
    'text-status-danger': 'text-status-danger',
    'text-status-info': 'text-status-info',
}

def fix_duplicates_in_file(filepath):
    """Corrigir duplicatas em um arquivo"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Corrigir duplicatas óbvias
        for old, new in DUPLICATES.items():
            content = content.replace(old, new)
        
        # Corrigir padrões específicos
        # border-border-* → border-*
        content = re.sub(r'border-border-([a-z-]+)', r'border-\1', content)
        
        # text-text-* → text-*
        content = re.sub(r'text-text-([a-z-]+)', r'text-\1', content)
        
        # bg-bg-* → bg-*
        content = re.sub(r'bg-bg-([a-z-]+)', r'bg-\1', content)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"⚠️  Erro ao processar {filepath}: {e}")
        return False

def main():
    workspace_path = Path('c:/Users/robso/OneDrive/Documentos/Coorporativo/copilot 2026')
    
    # Procurar arquivos TSX
    tsx_files = list(workspace_path.glob('components/**/*.tsx')) + list(workspace_path.glob('app/**/*.tsx'))
    
    fixed_count = 0
    
    for tsx_file in tsx_files:
        if fix_duplicates_in_file(str(tsx_file)):
            fixed_count += 1
            print(f"✓ Corrigido: {tsx_file.relative_to(workspace_path)}")
    
    print(f"\nTotal de arquivos corrigidos: {fixed_count}")

if __name__ == '__main__':
    main()
