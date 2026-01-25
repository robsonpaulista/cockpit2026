#!/usr/bin/env python3
"""
Script para atualizar tema de cores em componentes TSX
De tema azul para tema premium bege/ouro
"""

import os
import re
from pathlib import Path

# Mapeamento de cores antigas para novas
COLOR_REPLACEMENTS = [
    # Cores primárias
    ('text-primary/60', 'text-secondary'),
    ('text-primary/40', 'text-secondary'),
    ('text-primary/20', 'text-muted'),
    ('text-primary', 'text-text-primary'),
    ('bg-primary-soft', 'bg-accent-gold-soft'),
    ('bg-primary/20', 'bg-accent-gold-soft'),
    ('bg-primary/10', 'bg-accent-gold-soft'),
    ('border-primary/60', 'border-accent-gold/60'),
    ('border-primary/50', 'border-accent-gold/50'),
    ('border-primary/40', 'border-accent-gold/40'),
    ('border-primary/30', 'border-accent-gold/30'),
    ('border-primary/20', 'border-accent-gold/20'),
    ('border-primary', 'border-accent-gold'),
    ('hover:text-primary', 'hover:text-accent-gold'),
    ('text-primary', 'text-accent-gold'),
    ('bg-primary-dark', 'bg-accent-gold'),
    ('hover:bg-primary-dark', 'hover:bg-accent-gold'),
    ('hover:bg-primary', 'hover:bg-accent-gold'),
    ('focus:ring-primary-soft', 'focus:ring-accent-gold-soft'),
    ('focus:ring-primary', 'focus:ring-accent-gold'),
    ('focus:border-primary', 'focus:border-accent-gold'),
    ('bg-primary text-white', 'bg-accent-gold text-white'),
    ('bg-primary', 'bg-accent-gold'),
    # Cor de background
    ('bg-surface', 'bg-bg-surface'),
    # Bordas
    ('border-border', 'border-border-card'),
    # Texto
    ('text-text-strong', 'text-text-primary'),
    ('text-text-muted', 'text-text-secondary'),
    ('text-muted', 'text-text-muted'),
    # Easing
    ('ease-premium', 'ease-out'),
]

def update_file(filepath):
    """Atualizar um arquivo com as substituições de cores"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        for old, new in COLOR_REPLACEMENTS:
            content = content.replace(old, new)
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Erro ao processar {filepath}: {e}")
        return False

def main():
    workspace_path = Path('c:/Users/robso/OneDrive/Documentos/Coorporativo/copilot 2026')
    
    # Procurar arquivos TSX em componentes e app
    tsx_files = list(workspace_path.glob('components/**/*.tsx')) + list(workspace_path.glob('app/**/*.tsx'))
    
    updated_count = 0
    
    for tsx_file in tsx_files:
        if update_file(str(tsx_file)):
            updated_count += 1
            print(f"✓ Atualizado: {tsx_file.relative_to(workspace_path)}")
    
    print(f"\nTotal de arquivos atualizados: {updated_count}")

if __name__ == '__main__':
    main()
