# Tarefas estilo Notion — tabela agrupada por data + detalhe reorganizado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o quadro kanban da aba Tarefas por uma tabela agrupada por data (estilo agenda), e reorganizar a página de detalhe da tarefa pra um layout de propriedades verticais estilo Notion, com Comentários reposicionados e um novo valor de Status ("Adiado").

**Architecture:** Uma migration amplia o `check constraint` de `tarefas.status`. Dois arquivos de UI são reescritos em paralelo (não têm dependência um do outro): `TarefasClient.tsx` troca a renderização do quadro kanban por uma tabela agrupada; `TarefaDetalhe.tsx` reordena suas seções. Nenhuma lógica de negócio (conclusão, subtasks, RLS) muda — só o layout e a adição do valor "adiado".

**Tech Stack:** Vite 6, React 19, TypeScript 5, date-fns (+ `date-fns/locale` ptBR, padrão já usado em `AgendarClient.tsx`/`CalendarioClient.tsx`), Supabase.

## Global Constraints

- `npm run build` (tsc --noEmit && vite build) precisa passar limpo antes de qualquer task ser considerada concluída.
- Este projeto não tem suite de testes automatizados — "testar" = build limpo + checklist manual.
- Nunca commitar a pasta `dist/` dentro de uma task normal — só depois do merge final de toda a feature.
- "Concluídos" (checkbox, na tabela e na página de detalhe) é a MESMA ação de concluir que já existe (`concluirTarefa` em `src/app/tarefas/tarefasAcoes.ts`) — não criar um campo booleano novo.
- "Urgências" é o campo `prioridade` já existente, só re-rotulado (alta → "Urgente").
- "Status" ganha um 4º valor (`adiado`), lista fixa — nunca selecionável como `concluida` nos selects (esse valor nunca é escolhido manualmente, só existe por compatibilidade histórica).
- Tarefas padrão (molde, `padrao: true`) continuam exclusivamente no modal atual — sem mudança nesta feature.
- "+ Add a property" na página de detalhe é só visual, sem função.

---

## Task 1: Migration (status "adiado") + tipo em `types.ts`

**Files:**
- Create: `supabase/migrations/041_tarefas_status_adiado.sql`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `Tarefa['status']` passa a ser `'a_fazer' | 'fazendo' | 'adiado' | 'concluida'`. Consumido pelas Tasks 2 e 3 (ambas leem este tipo).

- [ ] **Step 1: Criar a migration**

Crie `supabase/migrations/041_tarefas_status_adiado.sql` com o conteúdo exato:

```sql
-- ============================================================================
-- 041 — Tarefas: status ganha o valor "adiado"
-- ============================================================================
-- supabase/migrations/010_tarefas.sql criou `status` com um check constraint
-- restrito a ('a_fazer', 'fazendo', 'concluida'). A reformulação da aba
-- Tarefas (tabela agrupada por data, estilo Notion) precisa de um 4º valor
-- organizacional ("Adiado") pras tarefas que ainda estão pendentes — não
-- afeta a lógica de conclusão, que continua baseada em remover/reagendar a
-- linha (ver tarefasAcoes.ts), não em mudar `status` para `concluida`.

alter table tarefas drop constraint if exists tarefas_status_check;
alter table tarefas add constraint tarefas_status_check
  check (status in ('a_fazer', 'fazendo', 'adiado', 'concluida'));
```

- [ ] **Step 2: Copiar a migration pro checkout principal (fora do worktree)**

O usuário aplica migrations manualmente pelo SQL Editor do Supabase. Copie o arquivo criado no Step 1 para o mesmo caminho relativo dentro do checkout principal do repositório: `D:\Projetos\projeto samuel\gestao-pro\supabase\migrations\041_tarefas_status_adiado.sql` (cópia simples de arquivo — NÃO é uma operação git, não rode `git add`/`git commit` nesse caminho).

- [ ] **Step 3: Atualizar o tipo em `types.ts`**

Em `src/lib/types.ts`, na interface `Tarefa`, troque a linha:

```ts
  status: 'a_fazer' | 'fazendo' | 'concluida'
```

por:

```ts
  status: 'a_fazer' | 'fazendo' | 'adiado' | 'concluida'
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos (o `Status` em `TarefasClient.tsx`/`TarefaDetalhe.tsx` é um alias de `Tarefa['status']`, então o tipo amplia automaticamente — nenhum outro arquivo deveria quebrar nesta task, já que nenhum `switch`/mapa exaustivo sobre `Status` existe ainda fora dos arquivos das Tasks 2 e 3).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/041_tarefas_status_adiado.sql src/lib/types.ts
git commit -m "feat: adiciona status 'adiado' nas tarefas"
```

---

## Task 2: `TarefasClient.tsx` — tabela agrupada por data (substitui o kanban)

**Files:**
- Modify: `src/app/tarefas/TarefasClient.tsx`

**Interfaces:**
- Consumes: `Tarefa['status']` incluindo `'adiado'` (Task 1). `corAvatar`, `iniciais`, `numeroDaLoja` de `./avatar` (já importados). `hoje`, `ativa`, `clientesDe`, `clientesAtivosDe`, `agruparChecklists` de `./checklistUtils` (já importados). `concluirTarefa` de `./tarefasAcoes` (já importado, sem mudança de assinatura).
- Produces: nenhuma interface nova consumida por outro arquivo.

- [ ] **Step 1: Adicionar o import do locale ptBR e dos ícones novos, remover os que deixam de ser usados**

Em `src/app/tarefas/TarefasClient.tsx`, troque o bloco de imports (linhas 11-26):

```ts
import {
  format, parseISO, isValid, isBefore,
} from 'date-fns'
import type { Tarefa, Membro, TarefaConcluida, Cliente, TarefaCliente, TarefaSubtarefa } from '@/lib/types'
import AnaliseTarefas from './AnaliseTarefas'
import PainelPrazos from './PainelPrazos'
import ComentariosTarefa from './ComentariosTarefa'
import ChecklistTarefas from './ChecklistTarefas'
import { corAvatar, iniciais, numeroDaLoja } from './avatar'
import { hoje, ativa, clientesDe, clientesAtivosDe, agruparChecklists } from './checklistUtils'
import { concluirTarefa } from './tarefasAcoes'
import {
  PageHeader, Metric, Modal, Field, Input, Select, Textarea, Badge,
  EmptyState, AddButton, Button, IconAction, RowActions, Tabs,
} from '@/components/ui'
import { IconClipboard, IconEdit, IconTrash, IconUsers, IconCheck, IconPlus, IconClock, IconCalendar, IconMessage } from '@/components/icons'
```

por:

```ts
import {
  format, parseISO, isValid, isBefore,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Tarefa, Membro, TarefaConcluida, Cliente, TarefaCliente, TarefaSubtarefa } from '@/lib/types'
import AnaliseTarefas from './AnaliseTarefas'
import PainelPrazos from './PainelPrazos'
import ComentariosTarefa from './ComentariosTarefa'
import ChecklistTarefas from './ChecklistTarefas'
import { corAvatar, iniciais, numeroDaLoja } from './avatar'
import { hoje, ativa, clientesDe, clientesAtivosDe, agruparChecklists } from './checklistUtils'
import { concluirTarefa } from './tarefasAcoes'
import {
  PageHeader, Metric, Modal, Field, Input, Select, Textarea, Badge, Card, Th,
  EmptyState, AddButton, Button, IconAction, RowActions, Tabs,
} from '@/components/ui'
import { IconClipboard, IconEdit, IconTrash, IconUsers, IconPlus, IconChevronRight, IconMessage } from '@/components/icons'
```

(`IconCheck`, `IconClock`, `IconCalendar` saem — só eram usados no card do kanban que esta task remove. `Card`, `Th`, `IconChevronRight` entram — usados na nova tabela.)

- [ ] **Step 2: Adicionar `Fragment` ao import do React**

Na linha 3, troque:

```ts
import { useEffect, useMemo, useState } from 'react'
```

por:

```ts
import { Fragment, useEffect, useMemo, useState } from 'react'
```

- [ ] **Step 3: Trocar `COLUNAS` por `STATUS_OPCOES`**

Troque o bloco (linhas 32-36):

```ts
// Só duas colunas: tarefa concluída "some" do quadro.
const COLUNAS: { key: Exclude<Status, 'concluida'>; label: string; dot: string }[] = [
  { key: 'a_fazer', label: 'A fazer', dot: 'bg-gray-400' },
  { key: 'fazendo', label: 'Fazendo', dot: 'bg-blue-500' },
]
```

por:

```ts
// Opções de status organizacional (tarefa concluída "some" da tabela — não é
// um valor escolhível aqui, ver concluirTarefa em tarefasAcoes.ts).
const STATUS_OPCOES: { key: Exclude<Status, 'concluida'>; label: string }[] = [
  { key: 'a_fazer', label: 'A fazer' },
  { key: 'fazendo', label: 'Fazendo' },
  { key: 'adiado', label: 'Adiado' },
]
```

- [ ] **Step 4: Remover os estados de drag-and-drop**

Troque a linha (linha 101-102):

```ts
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<Status | null>(null)
```

Delete essas duas linhas (sem substituição — a tabela não tem arrastar-e-soltar).

- [ ] **Step 5: Adicionar o agrupamento por data e o helper de edição inline**

Logo depois do bloco `tarefasAtivasTodas` (linhas 240-243):

```ts
  const tarefasAtivasTodas = tarefas.filter(t => !t.padrao && ativa(t)
    && (clientesDe(t).length === 0 || clientesAtivosDe(t, clientesArquivadosIds).length > 0))
```

adicione:

```ts
  // Agrupa as tarefas visíveis por prazo (data), em ordem cronológica — as
  // sem prazo ficam num grupo "Sem data", exibido primeiro.
  const gruposPorData = useMemo(() => {
    const mapa = new Map<string, Tarefa[]>()
    visiveis.forEach(t => {
      const chave = t.prazo || 'sem-data'
      const arr = mapa.get(chave)
      if (arr) arr.push(t); else mapa.set(chave, [t])
    })
    const chaves = [...mapa.keys()].sort((a, b) => {
      if (a === 'sem-data') return -1
      if (b === 'sem-data') return 1
      return a.localeCompare(b)
    })
    return chaves.map(chave => ({
      chave,
      label: chave === 'sem-data' ? 'Sem data' : format(parseISO(chave), "EEEE, d 'de' MMMM", { locale: ptBR }),
      tarefas: mapa.get(chave)!,
    }))
  }, [visiveis])

  // Edição inline de um campo da tabela: atualiza otimista, reverte em erro.
  // Substitui moverStatus (que fazia a mesma coisa só pra status, com um
  // load() completo depois — aqui não recarrega tudo, só corrige a linha).
  async function salvarCampoTarefa<K extends keyof Tarefa>(id: string, campo: K, valor: Tarefa[K]) {
    const t = tarefas.find(x => x.id === id)
    if (!t) return
    const anterior = t[campo]
    setTarefas(prev => prev.map(x => x.id === id ? { ...x, [campo]: valor } : x))
    try {
      await update<Tarefa>('tarefas', id, { [campo]: valor } as Partial<Tarefa>)
    } catch (err) {
      setTarefas(prev => prev.map(x => x.id === id ? { ...x, [campo]: anterior } : x))
      alert('Erro ao atualizar: ' + mensagemErro(err))
    }
  }
```

- [ ] **Step 6: Remover `moverStatus` e `onDrop` (substituídos por `salvarCampoTarefa`)**

Delete o bloco (linhas 378-394):

```ts
  async function moverStatus(id: string, status: Status) {
    const t = tarefas.find(x => x.id === id)
    if (!t || t.status === status) return
    const anterior = t.status
    setTarefas(prev => prev.map(x => x.id === id ? { ...x, status } : x))
    try {
      await update<Tarefa>('tarefas', id, { status })
      await load()
    } catch (err) {
      setTarefas(prev => prev.map(x => x.id === id ? { ...x, status: anterior } : x))
      alert('Erro ao mover: ' + mensagemErro(err))
    }
  }
  function onDrop(status: Status) {
    if (dragId) moverStatus(dragId, status)
    setDragId(null); setOverCol(null)
  }
```

sem substituição (apague as linhas).

- [ ] **Step 7: Substituir toda a renderização do quadro (bloco `view === 'quadro'`)**

Troque TODO o bloco a partir de `{view === 'quadro' && (<>` até o `</>)}` que fecha ele (no arquivo atual, da linha que contém exatamente `{view === 'quadro' && (<>` até a linha `</>)}` que vem logo antes de `{/* Modal Tarefa */}`) pelo bloco abaixo. Localize pelo texto exato — o bloco atual começa assim:

```tsx
      {view === 'quadro' && (<>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
```

e termina assim, imediatamente antes do comentário `{/* Modal Tarefa */}`:

```tsx
      )}
      </>)}

      {/* Modal Tarefa */}
```

Troque esse bloco inteiro (do `{view === 'quadro' && (<>` até o `</>)}` que vem antes de `{/* Modal Tarefa */}`) por:

```tsx
      {view === 'quadro' && (<>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Metric label="Pendentes" value={totalAtivas.toString()} icon={<IconClipboard className="w-6 h-6" />} />
        <Metric label="A fazer" value={porStatus('a_fazer').toString()} accent="text-gray-700" />
        <Metric label="Fazendo" value={porStatus('fazendo').toString()} accent="text-blue-600" />
        <Metric label="Recorrentes" value={recorrentes.toString()} accent="text-violet-600" />
      </div>

      {/* Abas por recorrência — filtram a tabela. */}
      <div className="mb-4">
        <Tabs
          active={filtroRec}
          onChange={setFiltroRec}
          tabs={[
            { value: 'todas', label: `Todas (${totalAtivas})` },
            { value: 'diaria', label: `Diárias (${recPorTipo.diaria})` },
            { value: 'semanal', label: `Semanais (${recPorTipo.semanal})` },
            { value: 'mensal', label: `Mensais (${recPorTipo.mensal})` },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {isAdmin && responsaveis.length > 0 && (
          <Select value={filtroResp} onChange={e => setFiltroResp(e.target.value)} className="!w-auto">
            <option value="todos">Todos os responsáveis</option>
            {responsaveis.map(([mail, nome]) => <option key={mail} value={mail}>{nome}</option>)}
          </Select>
        )}
        <Select value={exibirCliente} onChange={e => setExibirCliente(e.target.value as 'nome' | 'loja')} className="!w-auto">
          <option value="nome">Exibir: nome do cliente</option>
          <option value="loja">Exibir: loja</option>
        </Select>
      </div>

      {/* Abas por cliente — cada cliente com tarefa vira uma aba (rolagem
          horizontal quando não cabem todas). */}
      {clientesComTarefa.length > 0 && (
        <Tabs
          active={filtroCliente}
          onChange={setFiltroCliente}
          tabs={clienteTabs}
          className="!mb-4 overflow-x-auto flex-nowrap"
        />
      )}

      {showPainel && <PainelPrazos tarefas={visiveis} concluidas={concluidasFiltradas} onEditar={editar} />}

      {totalAtivas === 0 ? (
        <EmptyState
          icon={<IconClipboard className="w-6 h-6" />}
          title="Nenhuma tarefa pendente"
          description={isAdmin ? 'Crie tarefas e atribua aos colaboradores da equipe.' : 'Você não tem tarefas pendentes.'}
          action={<AddButton onClick={() => novo()}>Nova Tarefa</AddButton>}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <Th>Tarefa</Th>
                  <Th className="text-center">Concluídos</Th>
                  <Th>Data</Th>
                  <Th>Urgências</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {gruposPorData.map(grupo => (
                  <Fragment key={grupo.chave}>
                    <tr>
                      <td colSpan={6} className="px-4 py-2 bg-gray-50/70 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-800/60">
                        <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-400 capitalize">{grupo.label}</span>
                        <span className="ml-2 text-[11px] font-medium text-gray-400 dark:text-gray-600 tabular-nums">{grupo.tarefas.length}</span>
                      </td>
                    </tr>
                    {grupo.tarefas.map(t => {
                      const itens = clientesDe(t)
                      const prog = subProgresso.get(t.id)
                      const pendentes = prog ? prog.total - prog.feitas : 0
                      return (
                        <tr
                          key={t.id}
                          onClick={() => editar(t)}
                          className="group cursor-pointer border-b border-gray-50 dark:border-gray-800/60 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/40"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${corAvatar(t.id)}`} />
                              <div className="min-w-0">
                                <p className="text-[13.5px] font-medium text-gray-900 dark:text-gray-100 truncate">{t.titulo}</p>
                                {itens.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {itens.map((c, idx) => {
                                      const label = (exibirCliente === 'loja' ? c.loja : c.nome) || c.nome
                                      return (
                                        <span key={c.id ?? idx} className="inline-flex items-center gap-1 rounded-full bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-800 pl-0.5 pr-2 py-0.5">
                                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0 ${corAvatar(label)}`}>{iniciais(label)}</span>
                                          <span className="text-[10.5px] font-medium text-gray-600 dark:text-gray-300 truncate">{label || '—'}</span>
                                        </span>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                            {pendentes > 0 ? (
                              <span className="text-[10.5px] font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap" title="Conclua as subtasks antes">{prog!.feitas}/{prog!.total}</span>
                            ) : (
                              <input
                                type="checkbox"
                                onChange={() => concluir(t)}
                                className="w-4 h-4 rounded accent-green-600 cursor-pointer"
                                title="Concluir"
                              />
                            )}
                          </td>
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            {isAdmin ? (
                              <input
                                type="date"
                                value={t.prazo || ''}
                                onChange={e => salvarCampoTarefa(t.id, 'prazo', e.target.value || null)}
                                className="text-[12px] bg-transparent border-none outline-none text-gray-500 dark:text-gray-400 w-[110px] cursor-pointer"
                              />
                            ) : (
                              <span className={`text-[12px] ${atrasada(t) ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>{fmtData(t.prazo) || '—'}</span>
                            )}
                          </td>
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <select
                              value={t.prioridade}
                              onChange={e => salvarCampoTarefa(t.id, 'prioridade', e.target.value as Prioridade)}
                              className={`text-[11px] font-medium rounded-full px-2 py-1 border-none outline-none cursor-pointer ${PRIO[t.prioridade].color === 'red' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' : PRIO[t.prioridade].color === 'amber' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
                            >
                              <option value="alta">Urgente</option>
                              <option value="media">Média</option>
                              <option value="baixa">Baixa</option>
                            </select>
                          </td>
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <select
                              value={t.status === 'concluida' ? 'a_fazer' : t.status}
                              onChange={e => salvarCampoTarefa(t.id, 'status', e.target.value as Status)}
                              className="text-[11px] font-medium rounded-full px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-none outline-none cursor-pointer"
                            >
                              {STATUS_OPCOES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="inline-flex items-center gap-1 text-[11px] text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium whitespace-nowrap">
                              Abrir <IconChevronRight className="w-3 h-3" />
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </>)}
```

- [ ] **Step 8: Atualizar o `Select` de Status dentro do modal (tarefa padrão)**

No modal de criar/editar tarefa (que agora só edita tarefas padrão), troque (linha ~750-754 no arquivo atual):

```tsx
            <Field label="Status">
              <Select value={form.status} onChange={e => set('status', e.target.value)}>
                {COLUNAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
            </Field>
```

por:

```tsx
            <Field label="Status">
              <Select value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_OPCOES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
            </Field>
```

- [ ] **Step 9: Verificar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros. Preste atenção especial a:
- Nenhuma referência sobrando a `dragId`, `overCol`, `onDrop`, `moverStatus`, `COLUNAS`, `IconCheck`, `IconClock`, `IconCalendar` (todos removidos/substituídos nesta task).
- `gruposPorData`/`salvarCampoTarefa` definidos ANTES de serem usados no JSX (useMemo/function declarations ficam no corpo do componente, antes do `return`).

Run: `npm run build`
Expected: `tsc --noEmit && vite build` terminam sem erro.

- [ ] **Step 10: Commit**

```bash
git add src/app/tarefas/TarefasClient.tsx
git commit -m "feat: troca o kanban de Tarefas por tabela agrupada por data"
```

---

## Task 3: `TarefaDetalhe.tsx` — reordenar seções (propriedades verticais, comentários, descrição, checklist)

**Files:**
- Modify: `src/app/tarefas/TarefaDetalhe.tsx`

**Interfaces:**
- Consumes: `Tarefa['status']` incluindo `'adiado'` (Task 1). Todas as funções/estados já existentes neste arquivo (`salvarCampo`, `escolherResp`, `adicionarCliente`, `removerCliente`, `concluir`, `excluir`, `alternarSubtask`, `removerSubtask`, `adicionarSubtask`, `opcoesResp`, `selClientes`, `pendentes`) — SEM mudança de assinatura, só reposicionados no JSX.
- Produces: nenhuma interface nova consumida por outro arquivo.

- [ ] **Step 1: Adicionar `corAvatar` ao import de `./avatar`**

Em `src/app/tarefas/TarefaDetalhe.tsx`, linha 10, troque:

```ts
import { numeroDaLoja } from './avatar'
```

por:

```ts
import { corAvatar, numeroDaLoja } from './avatar'
```

- [ ] **Step 2: Substituir todo o corpo do `return` final (da bolinha+título até o `ComentariosTarefa`)**

Troque TODO o bloco a partir de `<input\n        value={titulo}` até o final do componente (incluindo o `<ComentariosTarefa tarefaId={tarefa.id} />` e o fechamento `</div>\n  )\n}`), ou seja: localize pelo texto exato, do início:

```tsx
      <input
        value={titulo}
```

até o final do arquivo:

```tsx
      <ComentariosTarefa tarefaId={tarefa.id} />
    </div>
  )
}
```

Troque esse trecho inteiro por:

```tsx
      <div className="flex items-center gap-2.5 mb-5">
        <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${corAvatar(tarefa.id)}`} />
        <input
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          onBlur={() => { if (titulo.trim() && titulo !== tarefa.titulo) salvarCampo('titulo', titulo.trim()) }}
          className="w-full text-2xl font-bold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100"
          placeholder="Título da tarefa"
        />
      </div>

      <div className="space-y-0.5 mb-5">
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Responsável</span>
          {isAdmin ? (
            <Select value={tarefa.responsavel_email} onChange={e => escolherResp(e.target.value)} className="!w-auto !border-none !shadow-none !bg-transparent !px-1">
              {opcoesResp.map(o => <option key={o.email} value={o.email}>{o.nome}</option>)}
            </Select>
          ) : (
            <span className="text-[13px] text-gray-700 dark:text-gray-300">{tarefa.responsavel_nome || tarefa.responsavel_email}</span>
          )}
        </div>
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Status</span>
          <Select
            value={tarefa.status === 'concluida' ? 'a_fazer' : tarefa.status}
            onChange={e => salvarCampo('status', e.target.value as Status)}
            className="!w-auto !border-none !shadow-none !bg-transparent !px-1"
          >
            <option value="a_fazer">A fazer</option>
            <option value="fazendo">Fazendo</option>
            <option value="adiado">Adiado</option>
          </Select>
        </div>
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Data</span>
          {isAdmin ? (
            <input
              type="date"
              value={tarefa.prazo || ''}
              onChange={e => salvarCampo('prazo', e.target.value || null)}
              className="text-[13px] bg-transparent border-none outline-none text-gray-700 dark:text-gray-300"
            />
          ) : (
            <span className="text-[13px] text-gray-700 dark:text-gray-300">{tarefa.prazo || 'Vazio'}</span>
          )}
        </div>
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Concluídos</span>
          <input
            type="checkbox"
            disabled={pendentes > 0}
            onChange={concluir}
            className="w-4 h-4 rounded accent-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
            title={pendentes > 0 ? `Conclua as ${pendentes} subtask(s) pendente(s)` : 'Concluir'}
          />
        </div>
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Urgências</span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIO_DOT[tarefa.prioridade]}`} />
            <Select value={tarefa.prioridade} onChange={e => salvarCampo('prioridade', e.target.value as Prioridade)} className="!w-auto !border-none !shadow-none !bg-transparent !px-1">
              <option value="alta">Urgente</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Recorrência</span>
          <Select value={tarefa.recorrencia} onChange={e => salvarCampo('recorrencia', e.target.value as Recorrencia)} className="!w-auto !border-none !shadow-none !bg-transparent !px-1">
            <option value="nenhuma">Sem recorrência</option>
            <option value="diaria">Diária</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </Select>
        </div>
        <div className="flex items-start gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500 pt-1">Clientes</span>
          <div className="flex-1 min-w-0">
            <Select value="" onChange={e => { adicionarCliente(e.target.value); e.target.value = '' }} className="!w-auto !border-none !shadow-none !bg-transparent !px-1">
              <option value="">Adicionar cliente…</option>
              {clientes.filter(c => !selClientes.some(s => s.id === c.id)).map(c => (
                <option key={c.id} value={c.id}>{c.nome}{c.loja ? ` — ${c.loja}` : ''}</option>
              ))}
            </Select>
            {selClientes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
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
        </div>
        <div className="flex items-center gap-2 py-1.5 text-gray-300 dark:text-gray-700">
          <IconPlus className="w-3.5 h-3.5" />
          <span className="text-[13px]">Add a property</span>
        </div>
      </div>

      <ComentariosTarefa tarefaId={tarefa.id} />

      <div className="my-6 border-t border-gray-100 dark:border-gray-800" />

      <Textarea
        rows={2}
        value={descricao}
        onChange={e => setDescricao(e.target.value)}
        onBlur={() => { if (descricao !== tarefa.descricao) salvarCampo('descricao', descricao) }}
        placeholder="Adicionar descrição…"
        className="!border-none !shadow-none !px-0 !bg-transparent mb-5"
      />

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
    </div>
  )
}
```

Note: o `onChange={concluir}` no checkbox "Concluídos" das propriedades chama a mesma função `concluir` já definida neste arquivo (que não recebe argumento — ela já usa a `tarefa` do estado do componente). Isso é intencional e idêntico ao comportamento do botão "Concluir tarefa" que continua existindo no final da página — ambos chamam a mesma ação.

- [ ] **Step 3: Verificar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros. Confirme que `corAvatar` está sendo usado (import novo do Step 1) e que nenhuma seção ficou duplicada (o grid antigo de 2 colunas com Responsável/Status/Prioridade/Recorrência/Prazo deixou de existir — cada campo agora aparece exatamente uma vez, na lista vertical).

Run: `npm run build`
Expected: `tsc --noEmit && vite build` terminam sem erro.

- [ ] **Step 4: Commit**

```bash
git add src/app/tarefas/TarefaDetalhe.tsx
git commit -m "feat: reorganiza a pagina de detalhe da tarefa em propriedades verticais"
```

---

## Task 4: Build final + checklist manual

**Files:** nenhum arquivo novo — task de integração/validação, depende das Tasks 2 e 3 (ambas já mergeadas/aplicadas no mesmo branch de trabalho).

- [ ] **Step 1: Build limpo**

Run: `npm run build`
Expected: sem erros, incluindo as mudanças das Tasks 2 e 3 juntas (confirma que não há conflito de tipos/nome entre os dois arquivos — eles não compartilham nenhum símbolo novo, só o tipo `Tarefa['status']` da Task 1).

- [ ] **Step 2: Checklist manual**

Via dev server ou navegador, logado como admin, na aba Tarefas:
1. Confirmar que o "Quadro" agora é uma tabela agrupada por data, com "Sem data" aparecendo antes de qualquer data.
2. Criar uma tarefa com prazo pra um dia específico e confirmar que ela aparece no grupo certo, com o cabeçalho do dia da semana capitalizado (ex.: "Segunda-feira, 4 de maio").
3. Mudar o Status de uma linha pra "Adiado" direto na tabela (select inline) e confirmar que persiste after reload.
4. Mudar a Data e a Urgência de uma linha direto na tabela e confirmar que persiste.
5. Marcar o checkbox "Concluídos" de uma linha sem subtasks pendentes e confirmar que ela desaparece (ou reagenda, se recorrente) — mesmo comportamento de antes.
6. Numa tarefa com subtasks pendentes, confirmar que o checkbox fica substituído pelo selo "x/y" (não é possível concluir direto pela tabela).
7. Clicar numa linha (fora das células de edição) e confirmar que abre a página de detalhe.
8. Na página de detalhe, confirmar a nova ordem: bolinha+título, propriedades verticais (Responsável/Status/Data/Concluídos/Urgências/Recorrência/Clientes/"+ Add a property"), Comentários, divisor, Descrição, Subtasks, botões Concluir/Excluir.
9. Marcar "Concluídos" na lista de propriedades da página de detalhe e confirmar que tem o mesmo efeito do botão "Concluir tarefa" no final da página.
10. Confirmar que uma tarefa padrão ainda abre o modal antigo (sem página de detalhe, sem tabela).
11. Logar como colaborador (não-admin) e confirmar que não pode editar Data (nem na tabela nem na página de detalhe).

- [ ] **Step 3: Commit final (se houver ajuste)**

```bash
git add -A
git commit -m "fix: ajustes finais pos-verificacao manual da tabela e pagina de detalhe"
```

Se nenhum ajuste foi necessário, não há o que commitar nesta task.
