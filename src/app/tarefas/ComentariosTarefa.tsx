// Comentários de uma tarefa — usado dentro do modal de editar tarefa.
// Ver/escrever: responsável da tarefa + admin (RLS da migration 031 já garante
// isso no banco; quem abre o modal de edição já passou por essa mesma regra
// em `tarefas`, então não há gate extra aqui).

import { useEffect, useState } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { getAll, insert } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { TarefaComentario } from '@/lib/types'
import { Textarea, Button } from '@/components/ui'
import { IconMessage } from '@/components/icons'

function mensagemErro(err: unknown): string {
  const e = err as { message?: string; code?: string }
  if (e?.code === '42501' || /row-level security|violates row-level/i.test(e?.message ?? '')) {
    return 'Você não tem permissão para comentar nesta tarefa.'
  }
  if (/relation .*tarefas_comentarios.* does not exist|could not find the table/i.test(e?.message ?? '')) {
    return 'A tabela de comentários não existe no banco. Aplique a migration 031 do Supabase.'
  }
  return e?.message || 'Erro desconhecido. Tente novamente.'
}

const fmt = (d: string) => (isValid(parseISO(d)) ? format(parseISO(d), 'dd/MM/yyyy HH:mm') : '')

export default function ComentariosTarefa({ tarefaId }: { tarefaId: string }) {
  const { name, email } = useAuth()
  const [comentarios, setComentarios] = useState<TarefaComentario[]>([])
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { carregar() }, [tarefaId])

  async function carregar() {
    setCarregando(true)
    try {
      const cs = await getAll<TarefaComentario>('tarefas_comentarios', {
        match: { tarefa_id: tarefaId },
        order: { column: 'criado_em', ascending: true },
      })
      setComentarios(cs); setErro(null)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setCarregando(false)
    }
  }

  async function comentar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setEnviando(true); setErro(null)
    try {
      await insert('tarefas_comentarios', {
        tarefa_id: tarefaId, texto: texto.trim(), autor_nome: name, autor_email: email,
      })
      setTexto(''); await carregar()
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
      <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2.5">
        <IconMessage className="w-3.5 h-3.5" /> Comentários
      </h4>

      {carregando ? (
        <p className="text-xs text-gray-400 py-1">Carregando…</p>
      ) : comentarios.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 py-1">Nenhum comentário ainda.</p>
      ) : (
        <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 mb-3">
          {comentarios.map(c => (
            <div key={c.id} className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{c.autor_nome || c.autor_email}</span>
                <span className="text-[10.5px] text-gray-400 dark:text-gray-500 shrink-0">{fmt(c.criado_em)}</span>
              </div>
              <p className="text-[13px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">{c.texto}</p>
            </div>
          ))}
        </div>
      )}

      {erro && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2">{erro}</p>}

      <form onSubmit={comentar} className="flex items-end gap-2">
        <Textarea
          rows={2}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escreva um comentário…"
          className="flex-1"
        />
        <Button type="submit" variant="secondary" disabled={enviando || !texto.trim()}>
          {enviando ? 'Enviando…' : 'Comentar'}
        </Button>
      </form>
    </div>
  )
}
