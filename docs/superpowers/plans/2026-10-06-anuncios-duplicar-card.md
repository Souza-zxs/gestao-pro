# Anúncios: duplicar card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão "Duplicar" ao card de Anúncio que cria uma cópia completa do anúncio na mesma etapa, com `" (cópia)"` no nome do produto.

**Architecture:** Mudança isolada em `src/app/anuncios/AnunciosClient.tsx` — uma função `duplicar(a: Anuncio)` que monta o payload a partir do anúncio existente e chama `insert('anuncios', ...)`, mais um botão no card usando o ícone `IconCopy` já existente. Sem mudança de banco.

**Tech Stack:** Vite 6, React 19, TypeScript 5, Supabase (via `src/lib/store.ts`).

## Global Constraints

- `npm run build` (tsc --noEmit && vite build) precisa passar limpo.
- Este projeto não tem suite de testes automatizados — "testar" = build limpo + checklist manual.
- Botão de duplicar só aparece pro admin (`isAdmin`), mesmo padrão dos botões Editar/Excluir já existentes no card.
- Sem confirmação antes de duplicar (ação não-destrutiva).
- Reaproveitar `insert`/`mensagemErro`/`load` já existentes no arquivo — não criar nenhum helper novo em outro arquivo.

---

## Task 1: Botão e função de duplicar no card de Anúncio

**Files:**
- Modify: `src/app/anuncios/AnunciosClient.tsx`

**Interfaces:**
- Consumes: `insert` de `@/lib/store` (já importado no arquivo), `mensagemErro` e `load` (já definidos no arquivo), tipo `Anuncio` de `@/lib/types` (já importado), `IconCopy` de `@/components/icons` (precisa adicionar ao import existente).
- Produces: nenhuma interface nova consumida por outro arquivo — é a feature completa.

- [ ] **Step 1: Adicionar `IconCopy` ao import de ícones**

Em `src/app/anuncios/AnunciosClient.tsx`, linha 14-16, troque:

```ts
import {
  IconMegaphone, IconEdit, IconTrash, IconCheck, IconChevronRight, IconUpload, IconClose, IconPlus,
} from '@/components/icons'
```

por:

```ts
import {
  IconMegaphone, IconEdit, IconTrash, IconCheck, IconChevronRight, IconUpload, IconClose, IconPlus, IconCopy,
} from '@/components/icons'
```

- [ ] **Step 2: Adicionar a função `duplicar`**

No mesmo arquivo, imediatamente depois da função `excluir` (linhas 273-277):

```ts
  async function excluir(a: Anuncio) {
    if (!confirm('Excluir este anúncio?')) return
    try { await remove('anuncios', a.id); await load() }
    catch (err) { alert('Erro ao excluir: ' + mensagemErro(err)) }
  }
```

adicione, logo após o `}` de fechamento de `excluir`:

```ts
  async function duplicar(a: Anuncio) {
    const payload = {
      cliente_id: a.cliente_id, cliente_nome: a.cliente_nome,
      nome_produto: `${a.nome_produto} (cópia)`, status: a.status, prioridade: a.prioridade,
      capa: a.capa, quebra_objecao: a.quebra_objecao, imagens_secundarias: a.imagens_secundarias,
      foto_url: a.foto_url, metodo_anuncio: a.metodo_anuncio, drive_produto: a.drive_produto,
      data: a.data, data_entrega: a.data_entrega,
      margem_ranqueamento: a.margem_ranqueamento, margem_final_esperada: a.margem_final_esperada,
      venda_fake_realizada: a.venda_fake_realizada,
      id_anuncio: a.id_anuncio, anuncio: a.anuncio,
      data_alteracao_preco: a.data_alteracao_preco, meta_vendas_subir_preco: a.meta_vendas_subir_preco,
      margem_final_realizada: a.margem_final_realizada,
    }
    try { await insert('anuncios', payload); await load() }
    catch (err) { alert('Erro ao duplicar: ' + mensagemErro(err)) }
  }
```

- [ ] **Step 3: Adicionar o botão "Duplicar" no card**

No mesmo arquivo, no bloco de ações do card (linhas 409-412), troque:

```tsx
                        {isAdmin && (<>
                          <button onClick={() => editar(a)} title="Editar" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconEdit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => excluir(a)} title="Excluir" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconTrash className="w-3.5 h-3.5" /></button>
                        </>)}
```

por:

```tsx
                        {isAdmin && (<>
                          <button onClick={() => duplicar(a)} title="Duplicar" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconCopy className="w-3.5 h-3.5" /></button>
                          <button onClick={() => editar(a)} title="Editar" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconEdit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => excluir(a)} title="Excluir" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconTrash className="w-3.5 h-3.5" /></button>
                        </>)}
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: `tsc --noEmit && vite build` terminam sem erro.

- [ ] **Step 5: Checklist manual**

Via dev server (`npm run dev`) ou navegador, logado como admin, na aba Anúncios:
1. Duplicar um card que está na 1ª coluna → confirmar que o duplicado aparece na mesma coluna, com `(cópia)` no nome do produto, e os mesmos campos preenchidos (foto, cliente, etc.) ao abrir pra editar.
2. Duplicar um card que está na última coluna (etapa final) → confirmar que o duplicado aparece lá mesmo, não volta pra primeira coluna.
3. Logar como colaborador (não-admin) → confirmar que o botão de duplicar não aparece no card.

- [ ] **Step 6: Commit**

```bash
git add src/app/anuncios/AnunciosClient.tsx
git commit -m "feat: adiciona opcao de duplicar card de anuncio"
```
