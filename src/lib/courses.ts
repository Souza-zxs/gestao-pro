// Lógica compartilhada de cursos: catálogo, conteúdo, matrículas e progresso.
// Agora assíncrona — lê/escreve no Supabase via @/lib/store.

import { getAll, insert, update } from './store'
import type { Curso, Modulo, Aula, Matricula } from './types'

export async function cursoById(id: string): Promise<Curso | undefined> {
  const cursos = await getAll<Curso>('cursos', { match: { id } })
  return cursos[0]
}

export async function cursosPublicados(): Promise<Curso[]> {
  return getAll<Curso>('cursos', { match: { publicado: true } })
}

export async function modulosDoCurso(cursoId: string): Promise<Modulo[]> {
  const modulos = await getAll<Modulo>('modulos', { match: { curso_id: cursoId }, order: { column: 'ordem' } })
  return modulos
}

export async function aulasDoModulo(moduloId: string): Promise<Aula[]> {
  return getAll<Aula>('aulas', { match: { modulo_id: moduloId }, order: { column: 'ordem' } })
}

export async function aulasDoCurso(cursoId: string): Promise<Aula[]> {
  return getAll<Aula>('aulas', { match: { curso_id: cursoId }, order: { column: 'ordem' } })
}

export async function matriculaDe(email: string, cursoId: string): Promise<Matricula | undefined> {
  const matriculas = await getAll<Matricula>('matriculas', { match: { aluno_email: email, curso_id: cursoId, status: 'ativa' } })
  return matriculas[0]
}

export async function matriculasDe(email: string): Promise<Matricula[]> {
  return getAll<Matricula>('matriculas', { match: { aluno_email: email, status: 'ativa' } })
}

/** Garante a matrícula do aluno no curso (cria se ainda não houver). */
export async function matricular(params: {
  cursoId: string
  alunoEmail: string
  alunoNome?: string
  pedidoId?: string
}): Promise<Matricula> {
  const existente = await matriculaDe(params.alunoEmail, params.cursoId)
  if (existente) return existente
  return insert<Omit<Matricula, 'id' | 'criado_em'>>('matriculas', {
    curso_id: params.cursoId,
    aluno_email: params.alunoEmail,
    aluno_nome: params.alunoNome,
    pedido_id: params.pedidoId,
    status: 'ativa',
    aulas_concluidas: [],
  })
}

/** Percentual de aulas concluídas (0–100). */
export function progressoPct(matricula: Matricula | undefined, totalAulas: number): number {
  if (!matricula || totalAulas === 0) return 0
  return Math.round((matricula.aulas_concluidas.length / totalAulas) * 100)
}

export async function alternarAulaConcluida(matricula: Matricula, aulaId: string): Promise<string[]> {
  const set = new Set(matricula.aulas_concluidas)
  if (set.has(aulaId)) set.delete(aulaId)
  else set.add(aulaId)
  const novas = [...set]
  await update<Matricula>('matriculas', matricula.id, { aulas_concluidas: novas })
  return novas
}
