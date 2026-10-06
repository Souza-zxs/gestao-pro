# Tarefas estilo Notion — tabela agrupada por data + detalhe reorganizado — Design

Data: 2026-10-06

## Objetivo

Reformular a aba Tarefas pra ficar visualmente e estruturalmente mais parecida com o Notion, com base em duas referências:
1. Uma tabela de tarefas agrupada por data (estilo agenda), com colunas Tarefa / Concluídos / Data / Urgências / Status.
2. Uma página de detalhe de tarefa com as propriedades em lista vertical (estilo painel de propriedades do Notion), comentários logo após as propriedades, e a checklist de subtasks (já existente) no final.

Isso substitui o quadro kanban (colunas "A fazer"/"Fazendo" com arrastar-e-soltar) construído numa sessão anterior, e reorganiza a página de detalhe (`TarefaDetalhe.tsx`, também construída numa sessão anterior) sem mudar a lógica de conclusão/subtasks já implementada — só o layout.

## Decisões fechadas no brainstorming

- **Kanban → tabela.** O quadro principal deixa de ser 2 colunas por status; passa a ser uma tabela.
- **Agrupamento por data real (agenda), não por dia da semana fixo.** Agrupa pelas tarefas pendentes pelo campo `prazo`, em ordem cronológica. Tarefas sem `prazo` caem num grupo "Sem data".
- **Status ganha um 4º valor: `adiado`.** Lista fixa (não customizável pelo admin, diferente do que foi feito pra Anúncios). Precisa de migration pra ampliar o `check constraint` de `tarefas.status` (hoje restrito a `a_fazer`/`fazendo`/`concluida` — ver `supabase/migrations/010_tarefas.sql:14`).
- **"Concluídos" (checkbox) é a MESMA ação de concluir que já existe hoje** — continua fazendo a tarefa desaparecer da tabela (não-recorrente) ou reagendar pro próximo período (recorrente). Não é um novo campo booleano persistido separado — é só a representação visual, em checkbox, do botão "Concluir" que já existe. "Status" (A fazer/Fazendo/Adiado) é só organizacional, pras tarefas que ainda estão pendentes.
- **"Urgências" = campo "Prioridade" já existente**, só renomeado/restilizado como badge colorido (ex: alta → "Urgente" em vermelho).
- **A checklist de nomes de clientes na referência é a checklist de subtasks de texto livre já construída** — nenhuma lógica nova aqui, só o reposicionamento na página.
- **"+ Add a property" é decorativo** — as propriedades da página continuam sendo as fixas (Responsável, Status, Data, Concluídos, Urgências, Recorrência, Clientes); não dá pra criar campo customizado de verdade.

## Modelo de dados

Nova migration (`04X_tarefas_status_adiado.sql`): dropa e recria o `check constraint` de `tarefas.status` incluindo `'adiado'` na lista de valores aceitos. Nenhuma coluna nova, nenhuma tabela nova.

```sql
alter table tarefas drop constraint if exists tarefas_status_check;
alter table tarefas add constraint tarefas_status_check check (status in ('a_fazer', 'fazendo', 'adiado', 'concluida'));
```

`src/lib/types.ts`: `Tarefa['status']` passa de `'a_fazer' | 'fazendo' | 'concluida'` para `'a_fazer' | 'fazendo' | 'adiado' | 'concluida'`.

## Tabela principal (substitui o Kanban)

**Agrupamento:** tarefas visíveis (mesma regra `ativa()` já existente) agrupadas por `prazo`, ordenadas cronologicamente. Cabeçalho de cada grupo no formato `"segunda-feira, 4 de maio"` (via `format(data, "EEEE, d 'de' MMMM", { locale: ptBR })`, mesmo padrão já usado em `AgendarClient.tsx`/`CalendarioClient.tsx`/`ApresentacoesClient.tsx` — `capitalize` via CSS, já que `date-fns` devolve em minúsculas). Tarefas sem `prazo` formam um grupo `"Sem data"` exibido primeiro (antes de qualquer data).

**Colunas:**
- **Tarefa** — bolinha decorativa colorida (cor estável derivada do `id` da tarefa via `corAvatar`, já existente em `src/app/tarefas/avatar.ts` — puramente visual, sem significado funcional) + título. Clique na linha (ou botão "Abrir", visível no hover, igual ao padrão de `RowActions`/hover já usado em outras telas) navega para `/tarefas/:id`.
- **Concluídos** — checkbox. Mesma lógica de `concluir(t)` já existente, incluindo a regra de bloqueio quando há subtask pendente (hoje implementada como ocultar o botão "Concluir" no card — na tabela, o checkbox fica desabilitado com um selo "x/y subtasks" ao lado, mesma ideia).
- **Data** — mostra `prazo` formatado (`dd/MM`); editável inline (date picker), só admin — mesma restrição de hoje.
- **Urgências** — badge de `prioridade` (reaproveita o mapa de cores já usado nos cards do kanban: alta=vermelho/"Urgente", média=amarelo, baixa=cinza); editável inline via select.
- **Status** — select inline com as 4 opções (A fazer, Fazendo, Adiado, Concluída — mas "Concluída" não deve ser selecionável aqui, já que conclusão acontece via checkbox; mostra só como label de leitura se uma linha antiga tiver esse valor).

**Sem arrastar-e-soltar** — a troca de status agora é só escolher no select da linha.

**Mantém:** filtros de responsável/cliente/recorrência (abas já existentes), botão "Nova Tarefa" (abre o mesmo modal rápido), painel de prazos, abas Checklist/Análise — tudo sem mudança de comportamento, só ajuste visual onde fizer sentido pra combinar com o novo estilo de tabela.

## Página de detalhe (`TarefaDetalhe.tsx`) — reorganizada

Nova ordem, de cima pra baixo:
1. Botão "Voltar" (sem mudança).
2. Bolinha colorida (mesma lógica da tabela) + título editável inline (sem mudança de comportamento, só adiciona a bolinha ao lado).
3. **Lista vertical de propriedades** (ícone + label + valor editável), substituindo o grid 2 colunas atual:
   - Responsável
   - Status (agora com a opção "Adiado")
   - Data (prazo)
   - Concluídos (checkbox — mesma ação de concluir)
   - Urgências (prioridade)
   - Recorrência
   - Clientes (mesma lógica de adicionar/remover já existente, só reposicionada pra dentro da lista de propriedades)
   - Uma linha final "+ Add a property" sem função (decorativa).
4. **Comentários** (`ComentariosTarefa`, componente já existente e sem mudança interna) — reposicionado pra logo após as propriedades (hoje fica no final da página).
5. Divisor visual.
6. **Descrição** (campo já existente, sem mudança de lógica, só de posição/estilo — bloco com fundo leve).
7. **Checklist de subtasks** (já existente, sem mudança de lógica).
8. Botões Concluir/Excluir permanecem, com a mesma regra de bloqueio por subtasks pendentes já implementada.

## Fora de escopo

- Tarefas padrão (molde) continuam exclusivamente no modal atual — sem página de detalhe, sem esta reformulação.
- Abas "Checklist" e "Análise" não mudam de lógica (podem ganhar ajuste visual leve se necessário pra manter consistência, mas sem mudança funcional).
- "+ Add a property" não cria campos de verdade.
- Status "Adiado" não é customizável pelo admin (lista fixa).
- Sem arrastar-e-soltar na nova tabela.

## Testes

- `npm run build` limpo.
- Checklist manual: criar tarefas com prazos em dias diferentes e sem prazo, confirmar agrupamento e ordem; marcar "Adiado" numa tarefa e confirmar que ela continua visível (só muda de badge); concluir uma tarefa pelo checkbox da tabela e confirmar que desaparece/reagenda igual a hoje; abrir uma tarefa e confirmar a nova ordem de seções na página de detalhe; confirmar que tarefa padrão ainda abre o modal antigo.
