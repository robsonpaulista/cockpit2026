#!/usr/bin/env python3
"""
Script para importar dados de obras do arquivo Excel geralobras.xlsx para o banco de dados
"""

import os
import sys
import json
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("Instalando openpyxl...")
    os.system("pip install openpyxl")
    import openpyxl

# Adicionar o diretório raiz ao path
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

def read_excel_file(file_path: str):
    """Lê o arquivo Excel e retorna os dados como lista de dicionários"""
    try:
        workbook = openpyxl.load_workbook(file_path)
        sheet = workbook.active
        
        # Ler cabeçalhos da primeira linha
        headers = []
        for cell in sheet[1]:
            headers.append(cell.value if cell.value else '')
        
        # Ler dados
        obras = []
        for row in sheet.iter_rows(min_row=2, values_only=False):
            obra = {}
            for idx, cell in enumerate(row):
                if idx < len(headers) and headers[idx]:
                    value = cell.value
                    # Normalizar nome da coluna
                    col_name = str(headers[idx]).strip()
                    
                    # Mapear colunas exatas do Excel
                    col_lower = col_name.lower().strip()
                    
                    if col_lower == 'municipio' or col_lower == 'município':
                        obra['municipio'] = str(value) if value else None
                    elif col_lower == 'obra':
                        obra['obra'] = str(value) if value else ''
                    elif col_lower == 'orgão' or col_lower == 'orgao':
                        obra['orgao'] = str(value) if value else None
                    elif col_lower == 'sei':
                        obra['sei'] = str(value) if value else None
                    elif col_lower == 'sei medição' or col_lower == 'sei medicao' or col_lower == 'sei_medicao':
                        obra['sei_medicao'] = str(value) if value else None
                    elif col_lower == 'status':
                        obra['status'] = str(value) if value else None
                    elif col_lower == 'publicação da os' or col_lower == 'publicacao da os' or col_lower == 'publicacao_os':
                        obra['publicacao_os'] = str(value) if value else None
                    elif col_lower == 'solicitação medição' or col_lower == 'solicitacao medicao' or col_lower == 'solicitacao_medicao':
                        obra['solicitacao_medicao'] = str(value) if value else None
                    elif col_lower == 'data medição' or col_lower == 'data medicao' or col_lower == 'data_medicao':
                        obra['data_medicao'] = str(value) if value else None
                    elif col_lower == 'status medição' or col_lower == 'status medicao' or col_lower == 'status_medicao':
                        obra['status_medicao'] = str(value) if value else None
                    elif col_lower == 'valor total' or col_lower == 'valor_total':
                        obra['valor_total'] = float(value) if value else None
            
            # Só adicionar se tiver nome da obra
            if obra.get('obra'):
                obras.append(obra)
        
        return obras
    except Exception as e:
        print(f"Erro ao ler arquivo Excel: {e}")
        return []

def generate_sql_insert(obras: list):
    """Gera SQL INSERT para as obras"""
    sql_statements = []
    
    for obra in obras:
        # Preparar valores
        municipio = f"'{obra.get('municipio', '').replace("'", "''")}'" if obra.get('municipio') else 'NULL'
        obra_nome = obra.get('obra', '').replace("'", "''")
        orgao = f"'{obra.get('orgao', '').replace("'", "''")}'" if obra.get('orgao') else 'NULL'
        sei = f"'{obra.get('sei', '').replace("'", "''")}'" if obra.get('sei') else 'NULL'
        sei_medicao = f"'{obra.get('sei_medicao', '').replace("'", "''")}'" if obra.get('sei_medicao') else 'NULL'
        status = f"'{obra.get('status', '').replace("'", "''")}'" if obra.get('status') else 'NULL'
        publicacao_os = f"'{obra.get('publicacao_os')}'" if obra.get('publicacao_os') else 'NULL'
        solicitacao_medicao = f"'{obra.get('solicitacao_medicao')}'" if obra.get('solicitacao_medicao') else 'NULL'
        data_medicao = f"'{obra.get('data_medicao')}'" if obra.get('data_medicao') else 'NULL'
        status_medicao = f"'{obra.get('status_medicao', '').replace("'", "''")}'" if obra.get('status_medicao') else 'NULL'
        valor_total = str(obra.get('valor_total')) if obra.get('valor_total') else 'NULL'
        
        sql = f"""INSERT INTO obras (
  municipio, obra, orgao, sei, sei_medicao, status,
  publicacao_os, solicitacao_medicao, data_medicao, status_medicao, valor_total
) VALUES (
  {municipio}, '{obra_nome}', {orgao}, {sei}, {sei_medicao}, {status},
  {publicacao_os}, {solicitacao_medicao}, {data_medicao}, {status_medicao}, {valor_total}
);"""
        sql_statements.append(sql)
    
    return sql_statements

def main():
    # Caminho do arquivo Excel
    excel_file = root_dir / 'geralobras.xlsx'
    
    if not excel_file.exists():
        print(f"Arquivo não encontrado: {excel_file}")
        print("Por favor, coloque o arquivo geralobras.xlsx na raiz do projeto")
        return
    
    print(f"Lendo arquivo: {excel_file}")
    obras = read_excel_file(str(excel_file))
    
    if not obras:
        print("Nenhuma obra encontrada no arquivo Excel")
        return
    
    print(f"Encontradas {len(obras)} obras")
    
    # Gerar SQL
    sql_statements = generate_sql_insert(obras)
    
    # Salvar em arquivo SQL
    output_file = root_dir / 'database' / 'import-obras-from-excel.sql'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("-- ============================================\n")
        f.write("-- IMPORTAR OBRAS DO ARQUIVO EXCEL\n")
        f.write("-- ============================================\n\n")
        f.write("-- Este arquivo foi gerado automaticamente pelo script import-obras-excel.py\n\n")
        for sql in sql_statements:
            f.write(sql + "\n\n")
    
    print(f"SQL gerado em: {output_file}")
    print(f"Total de {len(sql_statements)} INSERT statements gerados")
    print("\nPara importar, execute o arquivo SQL no banco de dados:")
    print(f"  psql -d seu_banco -f {output_file}")
    print("\nOu use o modal de importação na interface web.")

if __name__ == '__main__':
    main()
