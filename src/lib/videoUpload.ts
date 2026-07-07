// Upload de vídeo de aula direto pro navegador do usuário -> api.video, sem
// passar pela Supabase (arquivo de vídeo é grande demais pra uma Edge
// Function proxiar). O servidor só gera um "delegated upload token" de curta
// duração (Edge Function criar-upload-token-video) — a API key da conta
// nunca chega ao navegador. Ver supabase/migrations/025_video_apivideo.sql.

import { VideoUploader, type UploadProgressEvent } from '@api.video/video-uploader'
import { supabase } from './supabase'

/** Envia o arquivo de vídeo e devolve o id do vídeo na api.video. */
export async function enviarVideoAula(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ videoId: string }> {
  const { data, error } = await supabase.functions.invoke<{ tokenId?: string; error?: string }>(
    'criar-upload-token-video',
  )
  if (error) {
    let mensagem = error.message
    try {
      const corpo = await (error as unknown as { context?: Response }).context?.json()
      if (corpo?.error) mensagem = corpo.error
    } catch { /* mantém a mensagem genérica do SDK */ }
    throw new Error(mensagem)
  }
  if (!data?.tokenId) throw new Error('Não foi possível iniciar o envio do vídeo.')

  const uploader = new VideoUploader({ file, uploadToken: data.tokenId })
  if (onProgress) {
    uploader.onProgress((e: UploadProgressEvent) => {
      onProgress(e.totalBytes ? Math.round((e.uploadedBytes / e.totalBytes) * 100) : 0)
    })
  }

  const video = await uploader.upload()
  return { videoId: video.videoId }
}
