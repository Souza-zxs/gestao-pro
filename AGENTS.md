# Gestão Pro — guia para agentes

> SPA React que serve **dois apps num único domínio**: um app de **gestão** (`/`) e um **portal de cursos** (`/portal`). Backend 100% **Supabase** (Postgres + Auth + RLS) — não há servidor próprio.

## ⚠️ Isto NÃO é Next.js

Apesar de qualquer regra antiga, o projeto é **Vite 6 + React 19 + React Router 7** (SPA pura). Não existe `pages/`, App Router, server components nem `node_modules/next`. Ignore convenções de Next.

## Stack

- **Vite 6** + **TypeScript 5** + **React 19** + **React Router 7**
- **Tailwind CSS 4** (`@tailwindcss/vite`)
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) — Postgres, Auth, Row Level Security
- **Recharts** (gráficos), **date-fns** (datas), **pdfjs-dist** (apresentações)

## Rodar e buildar

```bash
npm install
cp .env.example .env.local   # VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173  (portal em /portal)
npm run build                # tsc --noEmit && vite build  → DEVE passar limpo
```

## Estrutura

```
src/
├── app/<modulo>/<Modulo>Client.tsx  # telas de gestão (dashboard, clientes, tarefas...)
├── portal/                          # portal de cursos (router próprio, basename="/portal")
├── components/ui.tsx                 # UI kit compartilhado (PageHeader, Card, Modal, Button...)
├── lib/
│   ├── supabase.ts  # cliente (lê VITE_SUPABASE_*)
│   ├── store.ts     # CRUD genérico: getAll/insert/update/remove/upsert + TABLES_WITH_USER_ID
│   ├── auth.tsx     # useAuth() — sessão e papel (Supabase Auth)
│   ├── rbac.ts      # papéis (admin/instrutor/aluno), capabilities, ROUTE_ROLES
│   ├── courses.ts   # catálogo, matrículas, progresso
│   ├── payment.ts   # camada de pagamento isolada (mock → trocável por gateway real)
│   └── subdomain.ts # resolveApp(): decide gestão x portal pelo caminho
├── App.tsx          # rotas da gestão (cada uma sob <RequireRoute>)
└── main.tsx         # monta App ou PortalApp
supabase/migrations/ # SQL versionado 001 → 017 (esquema + RLS) — rodar em ordem
```

## Regras ao editar

1. **Use o UI kit** (`components/ui.tsx`) e o **store** (`lib/store.ts`) — não criar acesso Supabase disperso nem reinventar botão/modal.
2. **Tabela nova escopada por usuário** → adicionar em `TABLES_WITH_USER_ID` (em `store.ts`) **e** criar policy de **RLS** na migration. Segurança mora no banco; o front é só conveniência.
3. **Papel/permissão** → checar `can(role, cap)` e `ROUTE_ROLES` em `rbac.ts`. `app_metadata.role` tem prioridade sobre `user_metadata.role`.
4. `npm run build` (typecheck + vite) **precisa passar limpo** antes de concluir.

## Documentação ("segundo cérebro")

Há um conjunto de notas interligadas no Obsidian do dono (vault → pasta `Gestão Pro/`, começando por `🧠 Gestão Pro — Mapa`) cobrindo arquitetura, modelo de dados, RBAC, portal, pagamento e migrations.
