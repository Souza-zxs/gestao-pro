# Resultados: filtro mensal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um filtro de mês na aba de Resultados que troca os valores da tabela e dos cards de métrica de "total do ano" para "valor daquele mês".

**Architecture:** Mudança isolada em `src/app/resultados/ResultadosClient.tsx`. Um novo estado `filtroMes` + seis pequenas funções seletoras locais (`metaSel`, `fatSel`, `pedidosSel`, `canceladosSel`, `validosSel`, `projecaoSel`) que escolhem entre as funções anuais e mensais já existentes no arquivo, dependendo do filtro. Sem mudança de banco.

**Tech Stack:** Vite 6, React 19, TypeScript 5.

## Global Constraints

- `npm run build` (tsc --noEmit && vite build) precisa passar limpo.
- Este projeto não tem suite de testes automatizados — "testar" = build limpo + checklist manual.
- Reaproveitar as funções `totalMeta`, `totalAno`, `totalPedidos`, `totalCancelados`, `totalValidos`, `projecaoDe`, `calcProjecao`, `metaDoMes`, `fatDoMes`, `pedidosDoMes`, `canceladosDoMes` já exportadas no topo do arquivo — não criar nenhuma função de cálculo nova, só a camada de escolha condicional.
- `fat_anterior_<n>` nunca aparece na tabela nem nos cards (fora de escopo).
- O modal de criar/editar resultado não muda.

---

## Task 1: Filtro de mês na tabela e nos cards de Resultados

**Files:**
- Modify: `src/app/resultados/ResultadosClient.tsx`

**Interfaces:**
- Consumes: `MESES`, `totalMeta`, `totalAno`, `totalPedidos`, `totalCancelados`, `totalValidos`, `projecaoDe`, `calcProjecao`, `metaDoMes`, `fatDoMes`, `pedidosDoMes`, `canceladosDoMes` — todos já definidos/exportados neste mesmo arquivo (linhas 23-48 da versão atual).
- Produces: nenhuma interface nova consumida por outro arquivo — é a feature completa.

- [ ] **Step 1: Adicionar o estado `filtroMes`**

Em `src/app/resultados/ResultadosClient.tsx`, logo depois da linha `const [filtroColab, setFiltroColab] = useState('todos')` (linha 87), adicione:

```ts
  const [filtroMes, setFiltroMes] = useState('todos')
```

- [ ] **Step 2: Adicionar as funções seletoras e trocar o cálculo dos totais**

No mesmo arquivo, troque o bloco (linhas 152-155):

```ts
  const somaFat = filtrados.reduce((s, r) => s + totalAno(r), 0)
  const somaPedidos = filtrados.reduce((s, r) => s + totalPedidos(r), 0)
  const somaCancelados = filtrados.reduce((s, r) => s + totalCancelados(r), 0)
  const somaValidos = filtrados.reduce((s, r) => s + totalValidos(r), 0)
```

por:

```ts
  const mesNum = filtroMes === 'todos' ? null : Number(filtroMes)
  const metaSel = (r: Resultado) => mesNum === null ? totalMeta(r) : metaDoMes(r, mesNum)
  const fatSel = (r: Resultado) => mesNum === null ? totalAno(r) : fatDoMes(r, mesNum)
  const pedidosSel = (r: Resultado) => mesNum === null ? totalPedidos(r) : pedidosDoMes(r, mesNum)
  const canceladosSel = (r: Resultado) => mesNum === null ? totalCancelados(r) : canceladosDoMes(r, mesNum)
  const validosSel = (r: Resultado) => pedidosSel(r) - canceladosSel(r)
  const projecaoSel = (r: Resultado) => mesNum === null ? projecaoDe(r) : calcProjecao(metaSel(r), fatSel(r))
  const mesAbrev = mesNum === null ? null : MESES.find(m => m.n === mesNum)?.label.slice(0, 3) ?? null

  const somaFat = filtrados.reduce((s, r) => s + fatSel(r), 0)
  const somaPedidos = filtrados.reduce((s, r) => s + pedidosSel(r), 0)
  const somaCancelados = filtrados.reduce((s, r) => s + canceladosSel(r), 0)
  const somaValidos = filtrados.reduce((s, r) => s + validosSel(r), 0)
```

- [ ] **Step 3: Label dinâmica no card de métrica "Faturamento"**

No mesmo arquivo, troque (linha 285):

```tsx
        <Metric label="Faturamento (ano)" value={brl(somaFat)} icon={<IconChart className="w-6 h-6" />} />
```

por:

```tsx
        <Metric label={mesAbrev ? `Faturamento (${mesAbrev})` : 'Faturamento (ano)'} value={brl(somaFat)} icon={<IconChart className="w-6 h-6" />} />
```

- [ ] **Step 4: Adicionar o `Select` de mês na barra de filtros**

No mesmo arquivo, depois do `Select` de ano (linhas 297-300):

```tsx
        <Select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className="!w-auto">
          <option value="todos">Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </Select>
```

adicione, imediatamente depois:

```tsx
        <Select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className="!w-auto">
          <option value="todos">Todos os meses</option>
          {MESES.map(m => <option key={m.n} value={String(m.n)}>{m.label}</option>)}
        </Select>
```

- [ ] **Step 5: Cabeçalhos dinâmicos da tabela**

No mesmo arquivo, troque (linhas 329-330):

```tsx
                  <Th>Meta (ano)</Th>
                  <Th>Faturamento (ano)</Th>
```

por:

```tsx
                  <Th>{mesAbrev ? `Meta (${mesAbrev})` : 'Meta (ano)'}</Th>
                  <Th>{mesAbrev ? `Faturamento (${mesAbrev})` : 'Faturamento (ano)'}</Th>
```

- [ ] **Step 6: Trocar as células da tabela para usar os seletores**

No mesmo arquivo, troque (linhas 346-351):

```tsx
                    <td className="px-4 py-3 text-gray-500">{brl(totalMeta(r))}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{brl(totalAno(r))}</td>
                    <td className="px-4 py-3 text-gray-700 text-center">{totalPedidos(r)}</td>
                    <td className="px-4 py-3 text-center"><Badge color={totalCancelados(r) > 0 ? 'red' : 'gray'}>{totalCancelados(r)}</Badge></td>
                    <td className="px-4 py-3 text-center font-semibold text-green-600">{totalValidos(r)}</td>
                    <td className="px-4 py-3 text-gray-500 text-center">{projecaoDe(r)}%</td>
```

por:

```tsx
                    <td className="px-4 py-3 text-gray-500">{brl(metaSel(r))}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{brl(fatSel(r))}</td>
                    <td className="px-4 py-3 text-gray-700 text-center">{pedidosSel(r)}</td>
                    <td className="px-4 py-3 text-center"><Badge color={canceladosSel(r) > 0 ? 'red' : 'gray'}>{canceladosSel(r)}</Badge></td>
                    <td className="px-4 py-3 text-center font-semibold text-green-600">{validosSel(r)}</td>
                    <td className="px-4 py-3 text-gray-500 text-center">{projecaoSel(r)}%</td>
```

Note: a coluna "Pedidos" e a coluna dentro do `Badge` de "Cancelados" não têm label fixo "(ano)" no cabeçalho atual, então o Step 5 não precisa tocar nos `<Th>Pedidos</Th><Th>Cancelados</Th>` — só "Meta (ano)" e "Faturamento (ano)" tinham o qualificador no texto.

- [ ] **Step 7: Verificar build**

Run: `npm run build`
Expected: `tsc --noEmit && vite build` terminam sem erro.

- [ ] **Step 8: Checklist manual**

Via dev server (`npm run dev`) ou navegador, na aba Resultados:
1. Selecionar cada um dos 12 meses, um por vez, e confirmar que a tabela mostra os valores daquele mês (comparar com o que está no modal de edição de um registro conhecido).
2. Confirmar que os cabeçalhos das colunas Meta/Faturamento mostram a abreviação do mês selecionado (ex: "Meta (Mar)").
3. Confirmar que o card "Faturamento" no topo também muda de label e valor.
4. Voltar para "Todos os meses" e confirmar que a tabela volta a mostrar os totais anuais, igual ao comportamento de antes desta mudança.
5. Combinar o filtro de mês com o filtro de ano e de colaborador e confirmar que continuam funcionando juntos.

- [ ] **Step 9: Commit**

```bash
git add src/app/resultados/ResultadosClient.tsx
git commit -m "feat: adiciona filtro mensal na aba de resultados"
```
