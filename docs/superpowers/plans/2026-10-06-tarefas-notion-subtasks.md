# Tarefas estilo Notion com subtasks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada tarefa do quadro (não-padrão) abre numa página própria (`/tarefas/:id`, estilo Notion) com todos os campos editáveis inline e uma checklist de subtasks; a tarefa só pode ser concluída quando todas as subtasks estiverem marcadas.

**Architecture:** Nova tabela `tarefas_subtarefas` (1:N com `tarefas`, RLS igual a `tarefas_comentarios`). Novo componente de página `TarefaDetalhe.tsx` registrado como rota React Router `/tarefas/:id`. `TarefasClient.tsx` passa a navegar para essa rota em vez de abrir o modal de edição para tarefas não-padrão; tarefas padrão (molde) continuam no modal atual, sem mudança.

**Tech Stack:** Vite 6, React 19, TypeScript 5, React Router 7 (`react-router-dom`), Supabase (Postgres + RLS), Tailwind 4, date-fns.

## Global Constraints

- `npm run build` (= `tsc --noEmit && vite build`) precisa passar limpo antes de qualquer task ser considerada concluída.
- Este projeto **não tem suite de testes automatizados** (sem vitest/jest no `package.json`) — "testar" aqui significa: build limpo + verificação manual guiada (via dev server / Chrome). Não introduzir um framework de testes novo (fora de escopo, não pedido).
- Usar sempre o UI kit (`src/components/ui.tsx`) e o store (`src/lib/store.ts`) — nunca acesso Supabase disperso fora dos padrões já usados no arquivo.
- Toda tabela nova escopada por usuário entra em `TABLES_WITH_USER_ID` (`store.ts`) e ganha RLS na migration — segurança mora no banco.
- Seguir o estilo de código existente: sem comentários óbvios, só comentar o não-óbvio (como já é o padrão dos arquivos deste projeto).
- `import ... from 'react-router-dom'` (não `'react-router'`) — é o pacote usado em `App.tsx`.

---

## Task 1: Migration `tarefas_subtarefas` (checklist dentro da tarefa)

**Files:**
- Create: `supabase/migrations/039_tarefas_subtarefas.sql`

**Interfaces:**
- Produces: tabela `tarefas_subtarefas(id, tarefa_id, user_id, titulo, concluido, concluido_em, ordem, criado_em)` com RLS — consumida pelas Tasks 2, 4 e 6 via `store.ts` (`getAll`/`insert`/`update`/`remove`).

- [ ] **Step 1: Criar o arquivo de migration**

Crie `supabase/migrations/039_tarefas_subtarefas.sql` com o conteúdo exato:

```sql
-- ============================================================================
-- 039 — Subtasks dentro de uma tarefa (checklist livre, estilo Notion)
-- ============================================================================
-- Cada tarefa comum (não-padrão) ganha uma lista de subtasks de texto livre.
-- A regra "só conclui com tudo marcado" vive no front (TarefaDetalhe.tsx /
-- TarefasClient.tsx); aqui só o armazenamento + RLS. Mesmo padrão de
-- visibilidade/escrita de tarefas_comentarios (migration 031): admin ou
-- responsavel_email da tarefa pai.

create table if not exists tarefas_subtarefas (
  id uuid primary key default uuid_generate_v4(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  concluido boolean not null default false,
  concluido_em timestamptz,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists tsub_tarefa_idx on tarefas_subtarefas (tarefa_id, ordem, criado_em);

alter table tarefas_subtarefas enable row level security;

drop policy if exists "tsub ver" on tarefas_subtarefas;
create policy "tsub ver" on tarefas_subtarefas for select to authenticated using (
  public.is_admin()
  or exists (
    select 1 from tarefas t
    where t.id = tarefas_subtarefas.tarefa_id
      and t.responsavel_email = (auth.jwt() ->> 'email')
  )
);

drop policy if exists "tsub escrever" on tarefas_subtarefas;
create policy "tsub escrever" on tarefas_subtarefas for insert to authenticated with check (
  user_id = auth.uid()
  and (
    public.is_admin()
    or exists (
      select 1 from tarefas t
      where t.id = tarefas_subtarefas.tarefa_id
        and t.responsavel_email = (auth.jwt() ->> 'email')
    )
  )
);

drop policy if exists "tsub editar" on tarefas_subtarefas;
create policy "tsub editar" on tarefas_subtarefas for update to authenticated using (
  public.is_admin()
  or exists (
    select 1 from tarefas t
    where t.id = tarefas_subtarefas.tarefa_id
      and t.responsavel_email = (auth.jwt() ->> 'email')
  )
) with check (
  public.is_admin()
  or exists (
    select 1 from tarefas t
    where t.id = tarefas_subtarefas.tarefa_id
      and t.responsavel_email = (auth.jwt() ->> 'email')
  )
);

drop policy if exists "tsub apagar" on tarefas_subtarefas;
create policy "tsub apagar" on tarefas_subtarefas for delete to authenticated using (
  public.is_admin()
  or exists (
    select 1 from tarefas t
    where t.id = tarefas_subtarefas.tarefa_id
      and t.responsavel_email = (auth.jwt() ->> 'email')
  )
);
```

- [ ] **Step 2: Validar sintaxe (sem aplicar ainda)**

Run: `cd "D:/Projetos/projeto samuel/gestao-pro" && npx supabase db push --dry-run`
Expected: a saída lista `039_tarefas_subtarefas.sql` como próxima migration pendente e mostra o SQL, sem erro de parsing. Se o comando falhar por falta de login/link (`supabase link` / `supabase login`), registre isso no relatório final da task (não é um bloqueio para as próximas tasks — o front compila independente do banco estar com a migration aplicada).

- [ ] **Step 3: Aplicar a migration no projeto Supabase linkado**

Run: `cd "D:/Projetos/projeto samuel/gestao-pro" && npx supabase db push`
Expected: `039_tarefas_subtarefas.sql` aplicada com sucesso (saída confirma). Se falhar por autenticação/link ausente, **não tente contornar com `--include-all` ou credenciais novas** — reporte o erro exato e deixe o arquivo da migration pronto no repositório para o usuário aplicar manualmente pelo SQL Editor do Supabase (copiar o conteúdo do Step 1).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/039_tarefas_subtarefas.sql
git commit -m "feat: adiciona tabela tarefas_subtarefas (checklist dentro da tarefa)"
```

---

## Task 2: Tipos e helper de leitura por id

**Files:**
- Modify: `src/lib/types.ts` (após a interface `TarefaComentario`, por volta da linha 173)
- Modify: `src/lib/store.ts`

**Interfaces:**
- Produces: `export interface TarefaSubtarefa { id, tarefa_id, user_id, titulo, concluido, concluido_em, ordem, criado_em? }` em `types.ts`; `export async function getById<T>(table: string, id: string, opts?: { select?: string }): Promise<T | null>` em `store.ts`; entrada `'tarefas_subtarefas'` em `TABLES_WITH_USER_ID`. Consumido pelas Tasks 4 e 6.

- [ ] **Step 1: Adicionar o tipo `TarefaSubtarefa`**

Em `src/lib/types.ts`, logo depois do fim da interface `TarefaComentario` (depois da chave de fechamento, antes do comentário `/* ---------- Resultado anual... */`), adicione:

```ts
// Subtask livre dentro de uma tarefa comum (não-padrão). A tarefa só é
// concluída na UI quando todas as subtasks estão com concluido=true — regra
// aplicada em TarefaDetalhe.tsx / TarefasClient.tsx, não no banco.
export interface TarefaSubtarefa {
  id: string
  tarefa_id: string
  user_id: string
  titulo: string
  concluido: boolean
  concluido_em: string | null
  ordem: number
  criado_em?: string
}
```

- [ ] **Step 2: Registrar a tabela em `TABLES_WITH_USER_ID`**

Em `src/lib/store.ts`, no `Set` `TABLES_WITH_USER_ID` (linha ~12-17), adicione `'tarefas_subtarefas'` à lista existente, por exemplo ao final:

```ts
const TABLES_WITH_USER_ID = new Set<string>([
  'colaboradores', 'pagamentos_config', 'agendamentos', 'horarios_disponiveis',
  'bloqueios', 'turmas', 'alunos', 'leads', 'eventos', 'news', 'apresentacoes',
  'financeiro', 'clientes', 'tarefas', 'membros', 'tarefas_concluidas', 'resultados',
  'categorias_financeiras', 'tarefas_comentarios', 'anuncios', 'tarefas_subtarefas',
])
```

- [ ] **Step 3: Adicionar o helper `getById`**

Em `src/lib/store.ts`, logo depois da função `getAll` (depois do seu `}` de fechamento), adicione:

```ts
/** Lê uma única linha por id (null se não existir ou RLS bloquear). */
export async function getById<T>(table: string, id: string, opts: { select?: string } = {}): Promise<T | null> {
  const { data, error } = await supabase.from(table).select(opts.select ?? '*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as T | null
}
```

- [ ] **Step 4: Verificar que o projeto tipa sem erros**

Run: `cd "D:/Projetos/projeto samuel/gestao-pro" && npx tsc --noEmit`
Expected: sem erros novos relacionados a `types.ts` ou `store.ts` (erros preexistentes em outros arquivos não relacionados a esta task, se houver, não são desta task — mas não deve haver nenhum, pois estas são adições puras).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/store.ts
git commit -m "feat: adiciona tipo TarefaSubtarefa e helper store.getById"
```

---

## Task 3: `rbac.ts` reconhece `/tarefas/:id`

**Files:**
- Modify: `src/lib/rbac.ts:77-82`

**Interfaces:**
- Consumes: nenhuma das outras tasks.
- Produces: `canAccessRoute` passa a tratar qualquer path iniciado por `/tarefas/` com as mesmas roles de `/tarefas`. Consumido pela Task 5 (rota nova em `App.tsx`, via `RequireRoute`).

- [ ] **Step 1: Atualizar `canAccessRoute`**

Em `src/lib/rbac.ts`, substitua a função atual (linhas 77-82):

```ts
export function canAccessRoute(role: Role | undefined | null, path: string): boolean {
  if (!role) return false
  const allowed = ROUTE_ROLES[path]
  if (!allowed) return true // rota sem restrição explícita
  return allowed.includes(role)
}
```

por:

```ts
export function canAccessRoute(role: Role | undefined | null, path: string): boolean {
  if (!role) return false
  // /tarefas/:id (página de detalhe) usa as mesmas regras de /tarefas.
  const chave = path.startsWith('/tarefas/') ? '/tarefas' : path
  const allowed = ROUTE_ROLES[chave]
  if (!allowed) return true // rota sem restrição explícita
  return allowed.includes(role)
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "D:/Projetos/projeto samuel/gestao-pro" && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rbac.ts
git commit -m "feat: canAccessRoute reconhece /tarefas/:id com as mesmas roles de /tarefas"
```

---

## Task 4: Página de detalhe `TarefaDetalhe.tsx`

**Files:**
- Create: `src/app/tarefas/TarefaDetalhe.tsx`

**Interfaces:**
- Consumes: `getAll`, `getById`, `insert`, `update`, `remove`, `currentUserId` de `@/lib/store` (Task 2); `TarefaSubtarefa`, `Tarefa`, `Membro`, `Cliente`, `TarefaCliente` de `@/lib/types` (Task 2); `clientesDe` de `./checklistUtils`; `numeroDaLoja` de `./avatar`; `ComentariosTarefa` (já existe, sem mudanças); `Select`, `Textarea`, `Button` de `@/components/ui`; `IconArrowLeft`, `IconCheck`, `IconTrash`, `IconPlus` de `@/components/icons`; `useAuth` de `@/lib/auth`; `useNavigate`, `useParams` de `react-router-dom`.
- Produces: `export default function TarefaDetalhe()` — um componente de página sem props (lê `id` da URL via `useParams`). Consumido pela Task 5 (`App.tsx`).

- [ ] **Step 1: Criar o componente completo**

Crie `src/app/tarefas/TarefaDetalhe.tsx` com o conteúdo exato:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addDays, addWeeks, addMonths, format } from 'date-fns'
import { getAll, getById, insert, update, remove, currentUserId } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { Tarefa, TarefaSubtarefa, Membro, Cliente, TarefaCliente } from '@/lib/types'
import { clientesDe } from './checklistUtils'
import { numeroDaLoja } from './avatar'
import ComentariosTarefa from './ComentariosTarefa'
import { Select, Textarea, Button } from '@/components/ui'
import { IconArrowLeft, IconCheck, IconTrash, IconPlus } from '@/components/icons'

type Status = Tarefa['status']
type Prioridade = Tarefa['prioridade']
type Recorrencia = Tarefa['recorrencia']

function mensagemErro(err: unknown): string {
  const e = err as { message?: string; code?: string }
  if (e?.code === '42501' || /row-level security|violates row-level/i.test(e?.message ?? '')) {
    return 'Você não tem permissão para esta ação.'
  }
  return e?.message || 'Erro desconhecido. Tente novamente.'
}

function proximaData(rec: Recorrencia): string {
  const base = new Date()
  const d = rec === 'diaria' ? addDays(base, 1) : rec === 'semanal' ? addWeeks(base, 1) : rec === 'mensal' ? addMonths(base, 1) : base
  return format(d, 'yyyy-MM-dd')
}

const PRIO_DOT: Record<Prioridade, string> = {
  alta: 'bg-red-500', media: 'bg-amber-500', baixa: 'bg-gray-300 dark:bg-gray-600',
}

export default function TarefaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role, name, email } = useAuth()
  const isAdmin = role === 'admin'

  const [tarefa, setTarefa] = useState<Tarefa | null>(null)
  const [subtarefas, setSubtarefas] = useState<TarefaSubtarefa[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [novaSubtask, setNovaSubtask] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { if (id) carregar(id) }, [id])

  async function carregar(tarefaId: string) {
    setCarregando(true)
    try {
      const [t, subs, ms, cl] = await Promise.all([
        getById<Tarefa>('tarefas', tarefaId),
        getAll<TarefaSubtarefa>('tarefas_subtarefas', { match: { tarefa_id: tarefaId }, order: { column: 'ordem', ascending: true } }),
        getAll<Membro>('membros', { order: { column: 'nome', ascending: true } }).catch(() => [] as Membro[]),
        getAll<Cliente>('clientes', { order: { column: 'nome', ascending: true } }).catch(() => [] as Cliente[]),
      ])
      if (!t) { setErro('Tarefa não encontrada.'); setTarefa(null); setCarregando(false); return }
      setTarefa(t); setTitulo(t.titulo); setDescricao(t.descricao)
      setSubtarefas(subs); setMembros(ms); setClientes(cl); setErro(null)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setCarregando(false)
    }
  }

  async function carregarSubtarefas() {
    if (!id) return
    setSubtarefas(await getAll<TarefaSubtarefa>('tarefas_subtarefas', { match: { tarefa_id: id }, order: { column: 'ordem', ascending: true } }))
  }

  async function salvarCampo<K extends keyof Tarefa>(campo: K, valor: Tarefa[K]) {
    if (!tarefa) return
    setTarefa(prev => prev ? { ...prev, [campo]: valor } : prev)
    try {
      await update<Tarefa>('tarefas', tarefa.id, { [campo]: valor } as Partial<Tarefa>)
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  const opcoesResp = (() => {
    const base = [{ nome: `${name} (você)`, email }, ...membros.map(m => ({ nome: m.nome, email: m.email }))]
    const vistos = new Set<string>()
    return base.filter(o => o.email && !vistos.has(o.email) && vistos.add(o.email))
  })()

  function escolherResp(mail: string) {
    const o = opcoesResp.find(x => x.email === mail)
    if (!o) return
    salvarCampo('responsavel_email', mail)
    salvarCampo('responsavel_nome', o.nome.replace(' (você)', ''))
  }

  const selClientes = tarefa ? clientesDe(tarefa) : []

  function adicionarCliente(cid: string) {
    if (!cid || !tarefa) return
    const c = clientes.find(x => x.id === cid)
    if (!c || selClientes.some(s => s.id === cid)) return
    const novo: TarefaCliente = { id: c.id, nome: c.nome, numero: numeroDaLoja(c.loja), loja: c.loja || '', telefone: c.telefone || '' }
    const lista = [...selClientes, novo]
    salvarCampo('clientes', lista)
    salvarCampo('cliente_id', lista[0]?.id || null)
    salvarCampo('cliente_nome', lista[0]?.nome || '')
  }

  function removerCliente(cid: string | null) {
    if (!tarefa) return
    const lista = selClientes.filter(c => c.id !== cid)
    salvarCampo('clientes', lista)
    salvarCampo('cliente_id', lista[0]?.id || null)
    salvarCampo('cliente_nome', lista[0]?.nome || '')
  }

  async function alternarSubtask(s: TarefaSubtarefa) {
    const concluido = !s.concluido
    const concluido_em = concluido ? new Date().toISOString() : null
    setSubtarefas(prev => prev.map(x => x.id === s.id ? { ...x, concluido, concluido_em } : x))
    try {
      await update<TarefaSubtarefa>('tarefas_subtarefas', s.id, { concluido, concluido_em })
    } catch (err) {
      setErro(mensagemErro(err))
      await carregarSubtarefas()
    }
  }

  async function removerSubtask(s: TarefaSubtarefa) {
    setSubtarefas(prev => prev.filter(x => x.id !== s.id))
    try {
      await remove('tarefas_subtarefas', s.id)
    } catch (err) {
      setErro(mensagemErro(err))
      await carregarSubtarefas()
    }
  }

  async function adicionarSubtask(e: React.FormEvent) {
    e.preventDefault()
    const texto = novaSubtask.trim()
    if (!texto || !id) return
    setNovaSubtask('')
    try {
      const criada = await insert<{ tarefa_id: string; titulo: string; ordem: number }>('tarefas_subtarefas', {
        tarefa_id: id, titulo: texto, ordem: subtarefas.length,
      })
      setSubtarefas(prev => [...prev, criada as unknown as TarefaSubtarefa])
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  async function registrarConclusao(t: Tarefa) {
    try {
      const uid = await currentUserId()
      const { error } = await supabase.from('tarefas_concluidas').insert({
        user_id: uid, tarefa_id: t.id, titulo: t.titulo,
        responsavel_nome: t.responsavel_nome, responsavel_email: t.responsavel_email,
        prioridade: t.prioridade, recorrencia: t.recorrencia,
        cliente_nome: t.cliente_nome ?? '',
        criada_em: t.criado_em ?? null,
        prazo: t.prazo ?? null,
      })
      if (error) console.warn('Conclusão não registrada no histórico:', error.message)
    } catch (err) {
      console.warn('Conclusão não registrada no histórico:', err)
    }
  }

  async function concluir() {
    if (!tarefa) return
    try {
      await registrarConclusao(tarefa)
      if (tarefa.recorrencia === 'nenhuma') await remove('tarefas', tarefa.id)
      else await update<Tarefa>('tarefas', tarefa.id, { status: 'a_fazer', prazo: proximaData(tarefa.recorrencia) })
      navigate('/tarefas')
    } catch (err) {
      setErro('Erro ao concluir: ' + mensagemErro(err))
    }
  }

  async function excluir() {
    if (!tarefa) return
    if (!confirm('Excluir tarefa?')) return
    try {
      await remove('tarefas', tarefa.id)
      navigate('/tarefas')
    } catch (err) {
      setErro('Erro ao excluir: ' + mensagemErro(err))
    }
  }

  if (carregando) return <p className="text-sm text-gray-400 px-1">Carregando…</p>

  if (!tarefa) {
    return (
      <div>
        <button onClick={() => navigate('/tarefas')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
          <IconArrowLeft className="w-4 h-4" /> Voltar para o quadro
        </button>
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro || 'Tarefa não encontrada.'}</p>
      </div>
    )
  }

  const pendentes = subtarefas.filter(s => !s.concluido).length

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/tarefas')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-5">
        <IconArrowLeft className="w-4 h-4" /> Voltar para o quadro
      </button>

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{erro}</p>}

      <input
        value={titulo}
        onChange={e => setTitulo(e.target.value)}
        onBlur={() => { if (titulo.trim() && titulo !== tarefa.titulo) salvarCampo('titulo', titulo.trim()) }}
        className="w-full text-2xl font-bold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 mb-2"
        placeholder="Título da tarefa"
      />
      <Textarea
        rows={2}
        value={descricao}
        onChange={e => setDescricao(e.target.value)}
        onBlur={() => { if (descricao !== tarefa.descricao) salvarCampo('descricao', descricao) }}
        placeholder="Adicionar descrição…"
        className="!border-none !shadow-none !px-0 !bg-transparent mb-5"
      />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Responsável</label>
          {isAdmin ? (
            <Select value={tarefa.responsavel_email} onChange={e => escolherResp(e.target.value)}>
              {opcoesResp.map(o => <option key={o.email} value={o.email}>{o.nome}</option>)}
            </Select>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400 py-2">{tarefa.responsavel_nome || tarefa.responsavel_email}</p>
          )}
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Status</label>
          <Select value={tarefa.status} onChange={e => salvarCampo('status', e.target.value as Status)}>
            <option value="a_fazer">A fazer</option>
            <option value="fazendo">Fazendo</option>
          </Select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Prioridade</label>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIO_DOT[tarefa.prioridade]}`} />
            <Select value={tarefa.prioridade} onChange={e => salvarCampo('prioridade', e.target.value as Prioridade)}>
              <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
            </Select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Recorrência</label>
          <Select value={tarefa.recorrencia} onChange={e => salvarCampo('recorrencia', e.target.value as Recorrencia)}>
            <option value="nenhuma">Sem recorrência</option>
            <option value="diaria">Diária</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </Select>
        </div>
        {isAdmin && (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Prazo</label>
            <input
              type="date"
              value={tarefa.prazo || ''}
              onChange={e => salvarCampo('prazo', e.target.value || null)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Clientes</label>
        <Select value="" onChange={e => { adicionarCliente(e.target.value); e.target.value = '' }}>
          <option value="">Adicionar cliente…</option>
          {clientes.filter(c => !selClientes.some(s => s.id === c.id)).map(c => (
            <option key={c.id} value={c.id}>{c.nome}{c.loja ? ` — ${c.loja}` : ''}</option>
          ))}
        </Select>
        {selClientes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selClientes.map((c, idx) => (
              <span key={c.id ?? idx} className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 pl-2 pr-1 py-1 text-xs text-amber-900">
                {(c.numero || numeroDaLoja(c.loja)) && <span className="font-mono font-semibold text-amber-700">{c.numero || numeroDaLoja(c.loja)}</span>}
                <span className="font-medium">{c.nome}</span>
                {c.loja && <span className="text-amber-700/80">· {c.loja}</span>}
                <button type="button" onClick={() => removerCliente(c.id)} className="ml-0.5 text-amber-500 hover:text-red-600 leading-none px-1">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
          Subtasks{subtarefas.length > 0 && ` · ${subtarefas.length - pendentes}/${subtarefas.length}`}
        </h4>
        <div className="space-y-1 mb-2">
          {subtarefas.map(s => (
            <div key={s.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <button
                type="button"
                onClick={() => alternarSubtask(s)}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${s.concluido ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}
              >
                {s.concluido && <IconCheck className="w-3 h-3" />}
              </button>
              <span className={`text-sm flex-1 ${s.concluido ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}`}>{s.titulo}</span>
              <button type="button" onClick={() => removerSubtask(s)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-opacity shrink-0">
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={adicionarSubtask} className="flex items-center gap-2 px-2">
          <IconPlus className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            value={novaSubtask}
            onChange={e => setNovaSubtask(e.target.value)}
            placeholder="Adicionar subtask…"
            className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-gray-400 text-gray-700 dark:text-gray-200 py-1"
          />
        </form>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <Button onClick={concluir} disabled={pendentes > 0} title={pendentes > 0 ? `Conclua as ${pendentes} subtask(s) pendente(s)` : undefined}>
          Concluir tarefa
        </Button>
        <Button variant="secondary" onClick={excluir}>Excluir</Button>
      </div>

      <ComentariosTarefa tarefaId={tarefa.id} />
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "D:/Projetos/projeto samuel/gestao-pro" && npx tsc --noEmit`
Expected: sem erros em `TarefaDetalhe.tsx`. Se houver erro de tipo em `salvarCampo` (ex.: `clientes` não é `keyof Tarefa` compatível com `Tarefa[K]`), ajuste o tipo do parâmetro `valor` chamando com `as never` apenas nesse ponto específico de chamada (não no helper genérico) — mantenha `salvarCampo` genérico.

- [ ] **Step 3: Commit**

```bash
git add src/app/tarefas/TarefaDetalhe.tsx
git commit -m "feat: adiciona página de detalhe da tarefa (TarefaDetalhe) com checklist de subtasks"
```

---

## Task 5: Rota `/tarefas/:id` em `App.tsx`

**Files:**
- Modify: `src/App.tsx:17` (imports) e `src/App.tsx:82` (rotas)

**Interfaces:**
- Consumes: `TarefaDetalhe` default export de `./app/tarefas/TarefaDetalhe` (Task 4).
- Produces: rota registrada — necessária para a navegação feita na Task 6 funcionar de ponta a ponta.

- [ ] **Step 1: Importar o componente**

Em `src/App.tsx`, depois da linha `import TarefasClient from './app/tarefas/TarefasClient'` (linha 17), adicione:

```ts
import TarefaDetalhe from './app/tarefas/TarefaDetalhe'
```

- [ ] **Step 2: Registrar a rota**

Em `src/App.tsx`, depois da linha `<Route path="/tarefas" element={<RequireRoute><TarefasClient /></RequireRoute>} />` (linha 82), adicione:

```tsx
        <Route path="/tarefas/:id" element={<RequireRoute><TarefaDetalhe /></RequireRoute>} />
```

- [ ] **Step 3: Verificar tipos e build**

Run: `cd "D:/Projetos/projeto samuel/gestao-pro" && npm run build`
Expected: build limpo (typecheck + vite build sem erros).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: registra rota /tarefas/:id"
```

---

## Task 6: `TarefasClient.tsx` — cards abrem a página, criação navega, selo de subtasks

**Files:**
- Modify: `src/app/tarefas/TarefasClient.tsx`

**Interfaces:**
- Consumes: `TarefaSubtarefa` de `@/lib/types` (Task 2); rota `/tarefas/:id` (Task 5, só precisa existir em runtime — não é dependência de compilação).
- Produces: nenhuma interface nova consumida por outra task — é a ponta final da UI do Quadro.

- [ ] **Step 1: Importar `useNavigate` e o tipo `TarefaSubtarefa`**

Em `src/app/tarefas/TarefasClient.tsx`, na linha 3, troque:

```ts
import { useEffect, useMemo, useState } from 'react'
```

por:

```ts
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
```

Na linha 14, troque:

```ts
import type { Tarefa, Membro, TarefaConcluida, Cliente, TarefaCliente } from '@/lib/types'
```

por:

```ts
import type { Tarefa, Membro, TarefaConcluida, Cliente, TarefaCliente, TarefaSubtarefa } from '@/lib/types'
```

- [ ] **Step 2: Criar o hook de navegação e o estado de progresso de subtasks**

Dentro de `export default function TarefasClient() {` (logo depois de `const isAdmin = role === 'admin'`, linha 82), adicione:

```ts
  const navigate = useNavigate()
```

Depois da linha `const [clientes, setClientes] = useState<Cliente[]>([])` (linha 87), adicione:

```ts
  const [subProgresso, setSubProgresso] = useState<Map<string, { total: number; feitas: number }>>(new Map())
```

- [ ] **Step 3: Buscar as subtasks de todas as tarefas visíveis dentro de `load()`**

Em `load()` (linha 114-143), troque o bloco do `Promise.all`:

```ts
      const [ts, ms, cs, cl] = await Promise.all([
        getAll<Tarefa>('tarefas', { order: { column: 'criado_em', ascending: false } }),
        getAll<Membro>('membros', { order: { column: 'nome', ascending: true } }).catch(() => [] as Membro[]),
        // RLS já restringe: admin vê tudo, colaborador só as próprias conclusões.
        getAll<TarefaConcluida>('tarefas_concluidas', { order: { column: 'concluida_em', ascending: false } }).catch(() => [] as TarefaConcluida[]),
        getAll<Cliente>('clientes', { order: { column: 'nome', ascending: true } }).catch(() => [] as Cliente[]),
      ])
      setMembros(ms); setConcluidas(cs); setClientes(cl); setErroCarregar(null)
```

por:

```ts
      const [ts, ms, cs, cl, subs] = await Promise.all([
        getAll<Tarefa>('tarefas', { order: { column: 'criado_em', ascending: false } }),
        getAll<Membro>('membros', { order: { column: 'nome', ascending: true } }).catch(() => [] as Membro[]),
        // RLS já restringe: admin vê tudo, colaborador só as próprias conclusões.
        getAll<TarefaConcluida>('tarefas_concluidas', { order: { column: 'concluida_em', ascending: false } }).catch(() => [] as TarefaConcluida[]),
        getAll<Cliente>('clientes', { order: { column: 'nome', ascending: true } }).catch(() => [] as Cliente[]),
        getAll<TarefaSubtarefa>('tarefas_subtarefas', { order: null }).catch(() => [] as TarefaSubtarefa[]),
      ])
      setMembros(ms); setConcluidas(cs); setClientes(cl); setErroCarregar(null)
      setSubProgresso(() => {
        const m = new Map<string, { total: number; feitas: number }>()
        subs.forEach(s => {
          const cur = m.get(s.tarefa_id) || { total: 0, feitas: 0 }
          cur.total += 1
          if (s.concluido) cur.feitas += 1
          m.set(s.tarefa_id, cur)
        })
        return m
      })
```

- [ ] **Step 4: `editar()` navega para a página quando a tarefa não é padrão**

Troque a função `editar` (linha 247-258):

```ts
  function editar(t: Tarefa) {
    setEditTarefa(t)
    setErroForm(null)
    setForm({
      titulo: t.titulo, descricao: t.descricao,
      responsavel_nome: t.responsavel_nome, responsavel_email: t.responsavel_email,
      prioridade: t.prioridade, status: t.status, recorrencia: t.recorrencia, prazo: t.prazo || '',
      padrao: t.padrao,
    })
    setSelClientes(clientesDe(t))
    setShowModal(true)
  }
```

por:

```ts
  function editar(t: Tarefa) {
    // Tarefa comum: abre a página de detalhe (estilo Notion, com subtasks).
    // Tarefa padrão (molde): continua no modal — não é uma tarefa executável.
    if (!t.padrao) { navigate(`/tarefas/${t.id}`); return }
    setEditTarefa(t)
    setErroForm(null)
    setForm({
      titulo: t.titulo, descricao: t.descricao,
      responsavel_nome: t.responsavel_nome, responsavel_email: t.responsavel_email,
      prioridade: t.prioridade, status: t.status, recorrencia: t.recorrencia, prazo: t.prazo || '',
      padrao: t.padrao,
    })
    setSelClientes(clientesDe(t))
    setShowModal(true)
  }
```

- [ ] **Step 5: Criação de uma tarefa única navega para a página dela**

Troque o trecho final de `salvar()` (linhas 336-344):

```ts
      } else {
        // Um cliente (ou nenhum): card único, como antes.
        const primeiro = selClientes[0]
        await insert('tarefas', {
          ...base, status: form.status, padrao: false, template_id: null,
          clientes: selClientes, cliente_id: primeiro?.id || null, cliente_nome: primeiro?.nome || '',
        })
      }
      fechar(); await load()
```

por:

```ts
      } else {
        // Um cliente (ou nenhum): card único — já abre a página dela (estilo Notion).
        // Sem generic explícito no insert (como já é o padrão no resto do arquivo):
        // o objeto literal não tem id/user_id, e Tarefa os exige — forçar <Tarefa>
        // quebraria a tipagem. O retorno inferido já tem `.id` (store.ts sempre anexa).
        const primeiro = selClientes[0]
        const criada = await insert('tarefas', {
          ...base, status: form.status, padrao: false, template_id: null,
          clientes: selClientes, cliente_id: primeiro?.id || null, cliente_nome: primeiro?.nome || '',
        })
        fechar()
        navigate(`/tarefas/${criada.id}`)
        return
      }
      fechar(); await load()
```

- [ ] **Step 6: Card do quadro — clicável, sem botão de editar, selo de subtasks**

Troque o bloco do card inteiro (linhas 587-649, de `<div\n   key={t.id}` até o `)})}` que fecha o `.map`):

```tsx
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null) }}
                      onDoubleClick={() => editar(t)}
                      title="Arraste para mudar o status · duplo clique para editar"
                      className={`group bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-3.5 cursor-grab active:cursor-grabbing transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-[0_2px_12px_rgba(15,23,42,0.07)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.3)] ${dragId === t.id ? 'opacity-40' : ''}`}
                    >
```

por:

```tsx
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null) }}
                      onClick={() => editar(t)}
                      title="Clique para abrir · arraste para mudar o status"
                      className={`group bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-3.5 cursor-pointer active:cursor-grabbing transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-[0_2px_12px_rgba(15,23,42,0.07)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.3)] ${dragId === t.id ? 'opacity-40' : ''}`}
                    >
```

Em seguida, dentro do mesmo card, troque o bloco de ações (linhas 637-647):

```tsx
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50 dark:border-gray-800/60">
                        <span className="inline-flex items-center gap-1.5 min-w-0 max-w-[55%]">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${corAvatar(t.responsavel_nome || t.responsavel_email)}`}>{iniciais(t.responsavel_nome || t.responsavel_email)}</span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{t.responsavel_nome || t.responsavel_email || '—'}</span>
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => concluir(t)} title="Concluir" className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"><IconCheck className="w-3 h-3" /> Concluir</button>
                          <button onClick={() => editar(t)} title="Editar" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconEdit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => excluir(t)} title="Excluir" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconTrash className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
```

por:

```tsx
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50 dark:border-gray-800/60">
                        <span className="inline-flex items-center gap-1.5 min-w-0 max-w-[55%]">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${corAvatar(t.responsavel_nome || t.responsavel_email)}`}>{iniciais(t.responsavel_nome || t.responsavel_email)}</span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{t.responsavel_nome || t.responsavel_email || '—'}</span>
                        </span>
                        <div className="flex items-center gap-0.5">
                          {(() => {
                            const prog = subProgresso.get(t.id)
                            const pendentes = prog ? prog.total - prog.feitas : 0
                            if (pendentes > 0) {
                              return <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 px-2 py-1">{prog!.feitas}/{prog!.total} subtasks</span>
                            }
                            return (
                              <button onClick={e => { e.stopPropagation(); concluir(t) }} title="Concluir" className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                                <IconCheck className="w-3 h-3" /> Concluir
                              </button>
                            )
                          })()}
                          <button onClick={e => { e.stopPropagation(); excluir(t) }} title="Excluir" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconTrash className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
```

- [ ] **Step 7: Verificar tipos**

Run: `cd "D:/Projetos/projeto samuel/gestao-pro" && npx tsc --noEmit`
Expected: sem erros. Se `IconEdit` ficar sem uso neste arquivo fora do contexto de tarefas padrão, **não remova o import** — ele ainda é usado no modal "Tarefas padrão" (lista de templates, mais abaixo no arquivo).

- [ ] **Step 8: Commit**

```bash
git add src/app/tarefas/TarefasClient.tsx
git commit -m "feat: cards do quadro abrem a página de detalhe da tarefa e mostram progresso de subtasks"
```

---

## Task 7: Build final, aplicação da migration e verificação manual ponta a ponta

**Files:** nenhum arquivo novo — task de integração/validação.

**Interfaces:**
- Consumes: todas as tasks anteriores (1-6) já commitadas.

- [ ] **Step 1: Build limpo**

Run: `cd "D:/Projetos/projeto samuel/gestao-pro" && npm run build`
Expected: `tsc --noEmit` e `vite build` terminam sem erro.

- [ ] **Step 2: Confirmar que a migration 039 foi aplicada (ou aplicar agora)**

Run: `cd "D:/Projetos/projeto samuel/gestao-pro" && npx supabase migration list`
Expected: `039_tarefas_subtarefas` aparece como aplicada remotamente. Se não aparecer, repita a Task 1 / Step 3 (`npx supabase db push`). Se o CLI não conseguir autenticar, pare aqui e reporte claramente ao usuário que o SQL do Step 1 da Task 1 precisa ser colado manualmente no SQL Editor do Supabase antes da feature funcionar em produção — isso é uma informação do relatório final, não um bloqueio para marcar as tasks de código como concluídas.

- [ ] **Step 3: Rodar o dev server e verificar manualmente**

Run: `cd "D:/Projetos/projeto samuel/gestao-pro" && npm run dev` (em background / outra aba)

Usando o navegador (Chrome automation ou manual), logado como admin, na aba Tarefas:

1. Criar uma tarefa simples sem cliente → deve navegar automaticamente para `/tarefas/<id>`.
2. Na página, adicionar 3 subtasks pelo campo "Adicionar subtask…".
3. Marcar 2 das 3 → confirmar que o cabeçalho mostra "Subtasks · 2/3" e o botão "Concluir tarefa" está desabilitado.
4. Marcar a 3ª → botão habilita → clicar → navega de volta para `/tarefas` e a tarefa não aparece mais no quadro.
5. Criar uma tarefa recorrente (ex. diária) com 1 subtask, concluir → confirmar que ela reaparece no quadro só quando o próximo prazo chegar (ou, para teste imediato, confirmar no banco/console que `prazo` foi avançado e `status` voltou a `a_fazer`).
6. No quadro, abrir uma tarefa com 2+ clientes vinculados, adicionar/remover um cliente na página, voltar ao quadro e confirmar que o card reflete a mudança.
7. Abrir uma tarefa padrão (em "Tarefas padrão") → confirmar que ainda abre o modal antigo, não a página nova.
8. Confirmar que a aba "Checklist" (quando houver tarefas recorrentes multi-cliente) continua funcionando exatamente como antes.
9. Logar como colaborador (não-admin) e abrir uma tarefa → confirmar que o campo Responsável aparece como texto (não editável) e que não há campo de Prazo.

- [ ] **Step 4: Registrar o resultado**

Anotar no corpo do commit final (ou na mensagem de encerramento da sessão) quais dos 9 itens do Step 3 passaram, e se a migration foi aplicada automaticamente ou precisa de aplicação manual pelo usuário.

- [ ] **Step 5: Commit final (se houver qualquer ajuste feito durante a verificação manual)**

```bash
git add -A
git commit -m "fix: ajustes finais pós-verificação manual da página de detalhe da tarefa"
```

Se nenhum ajuste foi necessário, não há o que commitar nesta task.
