# 🧠 COCKPIT 2026

Sistema Operacional de Gestão de Campanha Eleitoral

## 📌 Visão Geral

O Cockpit 2026 é uma aplicação web de gestão integrada de campanha eleitoral, criada para centralizar campo, comunicação, imprensa, base eleitoral, pesquisa, jurídico e operação em um único dashboard inteligente, automatizado e orientado à tomada de decisão.

## 🚀 Começando

### Pré-requisitos

- Node.js 18+ 
- npm ou yarn

### Instalação

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build

# Executar produção
npm start
```

O projeto estará disponível em `http://localhost:3000`

## 🏗️ Estrutura do Projeto

```
/
├── app/                    # App Router do Next.js
│   ├── layout.tsx         # Layout principal
│   ├── page.tsx           # Dashboard (Tela 0)
│   ├── globals.css        # Estilos globais
│   └── [rotas]/           # Páginas dos módulos
├── components/            # Componentes React
│   ├── sidebar.tsx        # Menu lateral
│   ├── header.tsx         # Cabeçalho com filtros
│   ├── kpi-card.tsx       # Card de KPI
│   ├── alert-card.tsx     # Card de alerta
│   └── action-card.tsx    # Card de ação
├── lib/                   # Utilitários e dados mockados
│   ├── utils.ts           # Funções utilitárias
│   └── mock-data.ts       # Dados mockados
├── types/                 # Definições TypeScript
│   └── index.ts           # Tipos principais
└── tailwind.config.ts     # Configuração Tailwind
```

## 🎨 Sistema de Design

### Paleta de Cores

- **Primary**: `#1E4ED8` (Azul principal)
- **Primary Dark**: `#1E3A8A`
- **Primary Soft**: `#EAF1FF`
- **Background**: `#F7F8FA`
- **Surface**: `#FFFFFF`
- **Text Strong**: `#0F172A`
- **Text Muted**: `#64748B`
- **Border**: `#E5E7EB`
- **Beige**: `#F3EEE4`

### Status

- **Success**: `#16A34A`
- **Warning**: `#F59E0B`
- **Error**: `#DC2626`

### Breakpoints

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## 📊 Módulos

1. **Visão Geral** - Dashboard executivo
2. **Fases da Campanha** - Adaptação ao calendário eleitoral
3. **Campo & Agenda** - Gestão territorial
4. **Banco de Narrativas** - Gestão de mensagens
5. **Conteúdo & Redes** - Comunicação
6. **Notícias & Crises** - Monitoramento
7. **Território & Base** - CRM político
8. **Mobilização** - Gestão de voluntários
9. **WhatsApp** - Comunicação direta
10. **Pesquisa & Relato** - Dados qualitativos
11. **Operação & Equipe** - Gestão interna
12. **Jurídico** - Compliance eleitoral

## 🛠️ Tecnologias

- **Next.js 14** - Framework React
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **Lucide React** - Ícones
- **Recharts** - Gráficos

## 📝 Notas

- Atualmente usando dados mockados para desenvolvimento
- Automações e integrações serão implementadas em fases futuras
- Banco de dados será integrado conforme necessário

## 🔐 Perfis de Acesso

O sistema suporta diferentes perfis:

- Candidato
- Coordenação
- Comunicação
- Articulação
- Jurídico
- BI / Inteligência

## 📄 Licença

Este projeto é privado e confidencial.




