// Lógica compartilhada de cursos: catálogo, conteúdo, matrículas e progresso.

import { getAll, insert, update } from './store'
import type { Curso, Modulo, Aula, Matricula } from './types'

export function cursoById(id: string): Curso | undefined {
  return getAll<Curso>('cursos').find(c => c.id === id)
}

export function cursosPublicados(): Curso[] {
  return getAll<Curso>('cursos').filter(c => c.publicado)
}

export function modulosDoCurso(cursoId: string): Modulo[] {
  return getAll<Modulo>('modulos')
    .filter(m => m.curso_id === cursoId)
    .sort((a, b) => a.ordem - b.ordem)
}

export function aulasDoModulo(moduloId: string): Aula[] {
  return getAll<Aula>('aulas')
    .filter(a => a.modulo_id === moduloId)
    .sort((a, b) => a.ordem - b.ordem)
}

export function aulasDoCurso(cursoId: string): Aula[] {
  return getAll<Aula>('aulas')
    .filter(a => a.curso_id === cursoId)
    .sort((a, b) => a.ordem - b.ordem)
}

export function matriculaDe(email: string, cursoId: string): Matricula | undefined {
  return getAll<Matricula>('matriculas').find(
    m => m.aluno_email === email && m.curso_id === cursoId && m.status === 'ativa',
  )
}

export function matriculasDe(email: string): Matricula[] {
  return getAll<Matricula>('matriculas').filter(m => m.aluno_email === email && m.status === 'ativa')
}

/** Garante a matrícula do aluno no curso (cria se ainda não houver). */
export function matricular(params: {
  cursoId: string
  alunoEmail: string
  alunoNome?: string
  pedidoId?: string
}): Matricula {
  const existente = matriculaDe(params.alunoEmail, params.cursoId)
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

export function alternarAulaConcluida(matricula: Matricula, aulaId: string): string[] {
  const set = new Set(matricula.aulas_concluidas)
  if (set.has(aulaId)) set.delete(aulaId)
  else set.add(aulaId)
  const novas = [...set]
  update<Matricula>('matriculas', matricula.id, { aulas_concluidas: novas })
  return novas
}
