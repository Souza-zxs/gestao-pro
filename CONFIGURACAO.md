# Gestão Pro

Sistema de gestão completo em português — Next.js + TypeScript + Tailwind CSS.

## Como rodar

```bash
npm install
npm run dev
```

Acesse http://localhost:3000

## Login

O sistema está em **modo demonstração**: qualquer e-mail e qualquer senha são aceitos.
- No **cadastro**, o nome digitado aparece no topo (ex: "Samuel").
- No **login**, é usado o trecho antes do `@` do e-mail como nome.

## Onde os dados ficam salvos

Todos os dados (colaboradores, alunos, financeiro, agenda, etc.) são salvos no
**`localStorage` do navegador** — não é necessário banco de dados para usar.
Para zerar tudo: **Configurações → Zona de perigo → Apagar todos os dados**.

## Módulos

| Rota | O que faz |
|------|-----------|
| `/dashboard` | Próximo evento, venda de ingressos, métricas e gráfico de receita |
| `/colaboradores` | Equipe (CLT/PJ), folha de pagamento com faltas/horas extras, aviso de férias |
| `/calendario` | Agenda mensal, horários de atendimento, bloqueios e link público |
| `/alunos` | Dashboard com 4 gráficos, CRUD de alunos e turmas |
| `/news` | Publicação de notícias (publicado/rascunho) |
| `/apresentacoes` | Apresentações com status agendada/realizada/cancelada |
| `/financeiro` | Entradas, saídas, saldo e fluxo de caixa |
| `/configuracoes` | Perfil, dados da empresa e reset de dados |
| `/agendar/[id]` | Página pública de agendamento (sem login) |

## Estrutura

```
src/
├── app/                  # Uma pasta por rota (page.tsx + *Client.tsx)
├── components/
│   ├── Navbar.tsx        # Navegação com ícones
│   ├── PageLayout.tsx    # Layout autenticado
│   ├── ui.tsx            # Kit de UI (Card, Button, Modal, Metric, etc.)
│   └── icons.tsx         # Ícones SVG
├── lib/
│   ├── store.ts          # CRUD em localStorage
│   ├── auth-mock.ts      # Sessão via cookie (modo demo)
│   └── types.ts          # Tipos TypeScript
└── proxy.ts              # Proteção de rotas (Next.js 16 = proxy, não middleware)
```

## Migrar para Supabase (opcional, futuro)

As migrations SQL em `supabase/migrations/` já contêm o schema completo com RLS,
caso queira trocar o `localStorage` por um banco real mais adiante. Hoje elas
**não são usadas** — o app funciona 100% offline no navegador.
