# Tarefas estilo Notion com subtasks — Design

Data: 2026-10-06

## Objetivo

Reformular a aba Tarefas para que cada tarefa possa ser aberta como uma página própria (estilo Notion) e só possa ser concluída quando todas as suas subtasks internas estiverem marcadas. Tarefas sem nenhuma subtask continuam concluíveis diretamente (regra vacuamente satisfeita).

## Fora de escopo

- O modo "Checklist" (`ChecklistTarefas.tsx`, que agrupa a mesma tarefa recorrente para 2+ clientes do mesmo responsável) não muda sua lógica de pendência/conclusão por linha.
- Tarefas padrão (modelo que gera uma cópia por cliente, `padrao = true`) continuam editadas pelo modal atual — não ganham página de detalhe nem subtasks, pois não são uma tarefa executável, são um molde.
- Sem reordenação de subtasks por arrastar (YAGNI — ordem de criação basta).
- Painel de prazos, Análise e demais telas que apenas chamam `onEditar(t)` não precisam de nenhuma mudança própria: herdam o novo comportamento porque `editar(t)` passa a decidir modal vs. página.

## Modelo de dados

### Nova tabela `tarefas_subtarefas`

Migration `supabase/migrations/039_tarefas_subtarefas.sql`:

```sql
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
```

RLS espelha o padrão de `tarefas_comentarios` (migration 031): visível/editável por admin ou pelo `responsavel_email` da tarefa pai (`tarefas.responsavel_email = auth.jwt() ->> 'email'`). Quatro políticas: ver (select), escrever (insert, com `user_id = auth.uid()`), editar (update — usada para marcar `concluido`/`concluido_em` e para renomear), apagar (delete).

### `src/lib/store.ts`

- Adicionar `'tarefas_subtarefas'` em `TABLES_WITH_USER_ID`.
- Novo helper genérico:
  ```ts
  export async function getById<T>(table: string, id: string, opts: { select?: string } = {}): Promise<T | null> {
    const { data, error } = await supabase.from(table).select(opts.select ?? '*').eq('id', id).maybeSingle()
    if (error) throw error
    return data as T | null
  }
  ```

### `src/lib/types.ts`

```ts
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

## Arquitetura de UI

### Rota nova

`src/App.tsx`: `<Route path="/tarefas/:id" element={<RequireRoute><TarefaDetalhe /></RequireRoute>} />`, importando `TarefaDetalhe` de `./app/tarefas/TarefaDetalhe`.

`src/lib/rbac.ts`: `canAccessRoute` passa a normalizar o path — se `path` começar com `/tarefas/`, trata como `/tarefas` na hora de consultar `ROUTE_ROLES` (mesmas roles: admin/instrutor). Implementação mínima:
```ts
export function canAccessRoute(role: Role | undefined | null, path: string): boolean {
  if (!role) return false
  const chave = path.startsWith('/tarefas/') ? '/tarefas' : path
  const allowed = ROUTE_ROLES[chave]
  if (!allowed) return true
  return allowed.includes(role)
}
```

### `src/app/tarefas/TarefaDetalhe.tsx` (novo componente)

Responsabilidades:
- Carrega a tarefa via `getById<Tarefa>('tarefas', id)` e suas subtasks via `getAll<TarefaSubtarefa>('tarefas_subtarefas', { match: { tarefa_id: id }, order: { column: 'ordem', ascending: true } })`, mais `membros` e `clientes` (iguais ao que `TarefasClient` já carrega) para popular os seletores de responsável/clientes.
- Botão "← Voltar" (`IconArrowLeft`) navega para `/tarefas`.
- Título: `<input>` sem borda, estilo "h1", salva em `onBlur` via `update('tarefas', id, { titulo })` se mudou.
- Descrição: `<Textarea>` sem borda visível, salva em `onBlur`.
- Linha de metadados (mesmo estilo dos badges do card atual): responsável (select se admin, texto se não), prioridade (select), status (select — a_fazer/fazendo), prazo (date, só admin), recorrência (select), clientes (mesmo seletor de adicionar/remover do modal atual) — cada mudança chama `update('tarefas', id, {...})` e recarrega o estado local.
- Seção "Subtasks" com contador "x/y":
  - Lista de itens com checkbox (`IconCheck` quando marcado) + título + botão remover (`IconTrash`, aparece no hover).
  - Marcar/desmarcar chama `update('tarefas_subtarefas', subId, { concluido, concluido_em })`.
  - Input "+ adicionar subtask" no final, `insert('tarefas_subtarefas', { tarefa_id, titulo, ordem })` com `ordem = subtasks.length`.
- Botão **Concluir**: desabilitado quando `subtasks.some(s => !s.concluido)`; ao clicar, reaproveita a mesma lógica de `concluir(t)` hoje em `TarefasClient` (registra em `tarefas_concluidas`, remove ou reagenda se recorrente) e navega para `/tarefas`.
- Botão Excluir: reaproveita a lógica de `excluir(t)` e navega para `/tarefas`.
- `<ComentariosTarefa tarefaId={id} />` ao final, igual ao modal atual.
- Mensagens de erro seguem o padrão `mensagemErro()` já usado no arquivo (duplicar a função pequena ou extrair para um util compartilhado se o agente de implementação achar mais limpo — decisão de implementação, não architetural).

### `src/app/tarefas/TarefasClient.tsx`

- Importa `useNavigate` do `react-router`.
- `editar(t)`: se `t.padrao`, comportamento atual (abre modal). Senão, `navigate(`/tarefas/${t.id}`)`.
- Card do quadro: `onClick` (não mais só `onDoubleClick`) chama `editar(t)` quando o clique não fez parte de um drag (comportamento nativo do HTML5 drag: um clique sem arrastar dispara `click` normalmente; um drag completo não dispara `click`). Mantém `draggable`, `onDragStart`, `onDragEnd`.
- Remove o botão de lápis (`IconEdit`) do card — abrir é só clicar; mantém "Concluir" e "Excluir" como ações rápidas.
- Botão "Concluir" do card: antes de mostrar, precisa saber se a tarefa tem subtasks pendentes — carregar contagem de subtasks (`pendentes`/`total`) junto com a lista de tarefas (uma query extra agrupada por `tarefa_id`, feita uma vez em `load()`) e mapear em um `Map<string, {total: number; feitas: number}>`. Se `total > 0 && feitas < total`, oculta o botão "Concluir" do card e mostra o selo "feitas/total" no lugar; senão mantém o botão como hoje.
- `novo()`/`salvar()`: ao criar com sucesso **uma única tarefa não-padrão** (branch `else` atual, sem múltiplos clientes), navega para `/tarefas/${criada.id}` em vez de só `fechar(); load()`. Os branches de tarefa padrão e de N cópias (múltiplos clientes) continuam fechando o modal e recarregando o quadro, sem navegação.

## Fluxo de conclusão — regra final

- 0 subtasks → "Concluir" sempre habilitado (comportamento idêntico ao atual).
- 1+ subtasks, alguma pendente → "Concluir" desabilitado (tooltip "Conclua as N subtask(s) pendente(s)"), botão oculto no card do quadro.
- Todas as subtasks marcadas → "Concluir" habilitado na página e reaparece no card.

## Testes / validação

- `npm run build` (typecheck + vite) limpo.
- Checklist manual via browser (Chrome automation ou dev server):
  1. Criar tarefa simples (sem cliente) → deve navegar para a página dela.
  2. Adicionar 3 subtasks, marcar 2 → botão Concluir desabilitado, contador "2/3".
  3. Marcar a 3ª → botão habilita → clicar Concluir → volta para o quadro e a tarefa não aparece mais.
  4. Criar tarefa recorrente com subtasks → concluir → verificar que ela reaparece com o próximo prazo e as subtasks resetam ou continuam marcadas (decisão de implementação: **subtasks não resetam automaticamente** ao reagendar uma recorrente — ficam como estavam; é o usuário quem desmarca se quiser repetir o ciclo. Isso evita lógica extra não pedida).
  5. Abrir tarefa com 2+ clientes, editar campos inline, voltar ao quadro e confirmar persistência.
  6. Tarefa padrão: clicar nela ainda abre o modal atual, não a página nova.
  7. Checklist (aba) continua funcionando como antes.
  8. Testar como colaborador (não-admin): não vê campos de responsável/prazo editáveis, só os seus.
