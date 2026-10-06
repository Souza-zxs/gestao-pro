# Anúncios: duplicar card — Design

Data: 2026-10-06

## Objetivo

Permitir que o admin duplique um card de anúncio no quadro de Anúncios, mantendo todas as informações já preenchidas nele.

## Comportamento

- Botão "Duplicar" (ícone de cópia) no card, ao lado de Editar/Excluir — visível só pro admin, hover-only (mesmo padrão dos outros dois botões de ação do card).
- Ao clicar, cria um novo anúncio com:
  - Todos os campos idênticos ao original (cliente, imagens, método do anúncio, drive, datas, margens, id/anúncio, venda fake, etc.).
  - `nome_produto` com `" (cópia)"` adicionado ao final.
  - `status` igual ao do original — o duplicado nasce na mesma coluna/etapa, não volta pra primeira.
- Sem confirmação (não é destrutivo — só cria uma linha nova).
- Após criar, recarrega o quadro; o duplicado aparece ao lado do original, na mesma coluna.

## Fora de escopo

- Nenhuma mudança no banco — reaproveita a tabela `anuncios` e sua policy de insert já existentes (`035_anuncios.sql` / `038_anuncios_colunas_e_permissoes.sql`), que já restringe inserts a admin.
- Não duplica anexos externos de verdade (campos como `capa`, `foto_url` etc. são texto/link — copiar o texto/link é suficiente, não há arquivo binário próprio do anúncio pra duplicar).

## Implementação

**Arquivo:** `src/app/anuncios/AnunciosClient.tsx` (único arquivo tocado).

Nova função:
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

Botão no bloco de ações do card (ao lado do botão Editar existente, dentro do `{isAdmin && (<> ... </>)}`), usando `IconCopy` (já existe em `@/components/icons`), mesmo estilo visual (`opacity-0 group-hover:opacity-100`) dos botões Editar/Excluir.

## Testes

- `npm run build` limpo.
- Checklist manual: duplicar um card em pelo menos 2 etapas diferentes (incluindo a última coluna) → confirmar que o duplicado aparece na mesma coluna, com `(cópia)` no nome e todos os outros campos (foto, margens, datas) idênticos. Confirmar que colaborador (não-admin) não vê o botão Duplicar.
