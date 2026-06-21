# Gestão Pro

Sistema de gestão completo para pequenos negócios e infoprodutores: um **app de gestão** (dashboard, financeiro, CRM, tarefas, agenda) e um **portal de cursos** (catálogo, checkout, área do aluno e player) — tudo em uma única SPA React servida por um único domínio.

> Frontend em React + Vite. Backend e autenticação no **Supabase** (Postgres + Auth + Row Level Security). Sem servidor próprio para manter.

---

## ✨ Funcionalidades

### App de gestão (`/`)
- **Dashboard** — visão geral com indicadores e gráficos (Recharts).
- **Colaboradores** — cadastro de equipe, faltas e horas.
- **Calendário & Agendamento** — horários disponíveis, bloqueios e página pública de agendamento (`/agendar/:userId`).
- **Alunos & Turmas** — gestão de matrículas presenciais.
- **Leads** — funil de captação.
- **Clientes** — base de clientes.
- **Tarefas** — quadro kanban (arrastar e soltar) com prioridade, prazo, recorrência (diária/semanal/mensal) e atribuição por **Equipe** (membros).
- **News** — comunicados internos.
- **Apresentações** — upload e visualização de slides/PDF (pdf.js).
- **Financeiro** — entradas, saídas e configuração de pagamentos.
- **Configurações** — perfil, papéis e zona de perigo (apagar dados).

### Portal de cursos (`/portal`)
- **Catálogo** e **detalhe** do curso.
- **Checkout** simulado, com camada de pagamento isolada (`src/lib/payment.ts`) — basta implementar a interface para plugar Mercado Pago, Stripe etc.
- **Minha área**, **player** de aulas com progresso e **login** próprio do aluno.

### Controle de acesso (RBAC)
Três papéis com capacidades distintas (`src/lib/rbac.ts`):

| Papel | Acesso |
|-------|--------|
| **Administrador** | Gestão total + cursos |
| **Instrutor** | Cria e gerencia cursos, alunos, tarefas, leads (sem financeiro/colaboradores) |
| **Aluno** | Consome cursos no portal |

O gating acontece tanto no cliente (`RequireRoute`) quanto no banco, via **Row Level Security** com os helpers `public.is_team()` / `public.is_admin()`.

---

## 🧱 Stack

- **React 19** + **React Router 7** (SPA)
- **Vite 6** + **TypeScript 5**
- **Tailwind CSS 4**
- **Supabase** (`@supabase/supabase-js`) — Postgres, Auth e RLS
- **Recharts** (gráficos), **date-fns** (datas), **pdfjs-dist** (apresentações)

---

## 🚀 Começando

### Pré-requisitos
- Node.js 20+
- Uma conta no [Supabase](https://supabase.com) (plano gratuito serve)

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar o Supabase
1. Crie um projeto no painel do Supabase.
2. Em **Settings → API**, copie a **Project URL** e a chave **anon/publishable**.
3. Copie o arquivo de exemplo e preencha:
   ```bash
   cp .env.example .env.local
   ```
   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
   ```

> ⚠️ Use **apenas** a chave `anon`/`publishable` no frontend. A `service_role` ignora o RLS e **nunca** deve ir para um app de navegador.

### 3. Aplicar as migrations
Rode os arquivos de `supabase/migrations/*.sql` **em ordem** (001 → 011) no **SQL Editor** do Supabase (ou via Supabase CLI). Eles criam as tabelas, índices e as policies de RLS.

### 4. Rodar em desenvolvimento
```bash
npm run dev
```
Abra http://localhost:5173.

- App de gestão: http://localhost:5173/
- Portal de cursos: http://localhost:5173/portal

---

## 📜 Scripts

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Typecheck (`tsc --noEmit`) + build de produção |
| `npm run preview` | Servir o build de produção localmente |

---

## 📁 Estrutura

```
gestao-pro/
├── src/
│   ├── app/            # Páginas do app de gestão (um diretório por módulo)
│   ├── portal/         # Portal de cursos (router próprio)
│   ├── components/     # UI kit compartilhado (ui.tsx, icons.tsx, Navbar...)
│   ├── lib/
│   │   ├── supabase.ts # Cliente Supabase (lê VITE_SUPABASE_*)
│   │   ├── store.ts    # CRUD genérico sobre o Supabase (getAll/insert/update/remove/upsert)
│   │   ├── auth.tsx    # Sessão e papel do usuário (useAuth)
│   │   ├── rbac.ts     # Papéis, capacidades e gating de rota
│   │   ├── courses.ts  # Catálogo, matrículas e progresso
│   │   ├── payment.ts  # Camada de pagamento (mock; trocável por gateway real)
│   │   └── subdomain.ts# Decide entre app de gestão e portal pelo caminho (/portal)
│   ├── App.tsx         # Rotas do app de gestão
│   └── main.tsx        # Monta App ou PortalApp conforme o caminho
└── supabase/migrations # SQL versionado (esquema + RLS)
```

### Como gestão e portal coexistem
Um único domínio serve os dois apps. Tudo sob **`/portal`** monta o portal de cursos (`<BrowserRouter basename="/portal">`); o resto monta a gestão (ver `src/lib/subdomain.ts` e `src/main.tsx`). Não é preciso DNS de subdomínio nem servidor extra.

---

## ☁️ Deploy

Qualquer host de site estático (Vercel, Netlify, Cloudflare Pages...):

1. Build: `npm run build` → saída em `dist/`.
2. Configure as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no host.
3. Habilite o **fallback de SPA** (todas as rotas → `index.html`), necessário para rotas profundas como `/portal/curso/123` e `/agendar/:userId`.

---

## 🔒 Segurança

- Toda autorização é reforçada no banco por **Row Level Security** — o frontend é só conveniência.
- A chave exposta no cliente é a `anon`, que respeita as policies de RLS.
- Cada usuário só enxerga/edita as próprias linhas (filtro por `user_id` no servidor).

---

## 📝 Licença

Projeto privado. Todos os direitos reservados.
