# Resultados: filtro mensal — Design

Data: 2026-10-06

## Objetivo

Permitir filtrar a tabela de Resultados por mês específico, além do filtro de ano já existente, mostrando os valores daquele mês em vez do total anual.

## Comportamento

- Novo `Select` "Mês" na barra de filtros, ao lado do filtro de Ano: opção `"Todos os meses"` (padrão) + os 12 meses (reaproveita o array `MESES` já definido no arquivo).
- Com `"Todos os meses"` selecionado: comportamento idêntico ao atual — tabela e cards de métrica mostram totais anuais.
- Com um mês específico selecionado:
  - Coluna `Meta (ano)` → mostra `meta_<n>` do mês escolhido, cabeçalho muda pra `Meta (<Mês abrev.>)` (ex: `Meta (Mar)`).
  - Coluna `Faturamento (ano)` → mostra `fat_<n>`, cabeçalho `Faturamento (<Mês abrev.>)`.
  - Coluna `Pedidos` → mostra `pedidos_<n>`.
  - Coluna `Cancelados` → mostra `cancelados_<n>`.
  - Coluna `Pedidos válidos` → `pedidos_<n> - cancelados_<n>`.
  - Coluna `Projeção` → `meta_<n> ÷ fat_<n> × 100` (mesma fórmula de `calcProjecao`, aplicada aos valores do mês).
  - Colunas `Ano`, `Colaborador`, `Cliente`, `Status` — não mudam (são campos do registro inteiro, não por mês).
  - Cards de métrica no topo (`Faturamento`, `Pedidos`, `Cancelados`, `Pedidos válidos`) somam os valores do mês escolhido em vez do ano inteiro.
- O filtro de mês combina livremente com o filtro de ano e os demais filtros já existentes (colaborador, busca) — não têm dependência um do outro.

## Fora de escopo

- O modal de criar/editar resultado não muda — continua mostrando os 12 meses lado a lado como hoje.
- `fat_anterior_<n>` (faturamento do mês anterior, usado só como referência dentro do modal) não aparece na tabela em nenhum cenário.

## Implementação

**Arquivo:** `src/app/resultados/ResultadosClient.tsx` (único arquivo tocado).

- Novo estado: `const [filtroMes, setFiltroMes] = useState<'todos' | string>('todos')` (string = número do mês como texto, `'1'`..`'12'`, mesmo padrão de `filtroAno`).
- Novo `Select` na barra de filtros (ao lado do `Select` de ano), usando `MESES` (já importado/definido) pra gerar as opções.
- Abreviação do mês pro cabeçalho: `MESES.find(m => String(m.n) === filtroMes)?.label.slice(0, 3)`.
- Os totais da tabela e dos cards passam a ser calculados por uma pequena função auxiliar que escolhe entre as funções já existentes (`totalMeta`/`totalAno`/`totalPedidos`/`totalCancelados`/`totalValidos`/`projecaoDe`, todas já exportadas neste arquivo) quando `filtroMes === 'todos'`, ou `metaDoMes`/`fatDoMes`/`pedidosDoMes`/`canceladosDoMes` (também já existentes) + `calcProjecao` quando um mês está selecionado. Nenhuma função de cálculo nova precisa ser criada — só uma camada de escolha condicional.

## Testes

- `npm run build` limpo.
- Checklist manual: selecionar cada um dos 12 meses e confirmar que os números da tabela e dos cards batem com o que foi digitado no modal pra aquele mês (testar em pelo menos 2 registros/clientes diferentes); voltar para "Todos os meses" e confirmar que volta a mostrar o total anual; confirmar que os filtros de ano/colaborador/busca continuam funcionando junto com o filtro de mês.
