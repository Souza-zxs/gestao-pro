// Helpers do Supabase Storage para o armazém de apresentações de slides.
// Os arquivos ficam no bucket privado "apresentacoes", organizados por usuário:
//   {user_id}/{timestamp}-{nome-do-arquivo}
// As policies de RLS (migration 005) garantem que cada usuário só acesse a
// própria pasta. As URLs de leitura são assinadas (expiram) por ser bucket privado.

import { supabase } from './supabase'
import { currentUserId } from './store'

const BUCKET = 'apresentacoes'

/** Remove acentos/caracteres problemáticos do nome para usar no path do Storage. */
function slugify(nome: string): string {
  return nome
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '')
}

/** Envia o arquivo e devolve os metadados a serem gravados na tabela. */
export async function uploadArquivo(file: File): Promise<{
  arquivo_path: string; arquivo_nome: string; arquivo_tipo: string; arquivo_tamanho: number
}> {
  const uid = await currentUserId()
  const path = `${uid}/${Date.now()}-${slugify(file.name)}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error

  return {
    arquivo_path: path,
    arquivo_nome: file.name,
    arquivo_tipo: file.type || '',
    arquivo_tamanho: file.size,
  }
}

/** Gera uma URL temporária (assinada) para visualizar/baixar o arquivo. */
export async function urlAssinada(path: string, expiraEm = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiraEm)
  if (error) throw error
  return data.signedUrl
}

/** Apaga o arquivo do Storage (chamar antes de remover a linha da tabela). */
export async function removerArquivo(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

// ---- Capas de cursos (bucket público "capas") -------------------------------
const BUCKET_CAPAS = 'capas'

/** Envia a imagem de capa e devolve a URL pública para salvar no curso. */
export async function uploadCapa(file: File): Promise<string> {
  const uid = await currentUserId()
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${uid}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_CAPAS).upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || undefined,
  })
  if (error) throw error
  return supabase.storage.from(BUCKET_CAPAS).getPublicUrl(path).data.publicUrl
}
