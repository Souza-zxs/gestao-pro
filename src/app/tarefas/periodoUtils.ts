// Filtro de período do dashboard de análise do admin: dia / semana / mês / ano,
// mais um recorte "dia da semana" (ex: todas as terças do mês exibido) — usado
// pelo filtro de tarefas diárias por dia da semana. Puro: sem estado, sem JSX.

import {
  addDays, addMonths, addWeeks, addYears,
  eachDayOfInterval, eachMonthOfInterval,
  endOfDay, endOfMonth, endOfWeek, endOfYear,
  format, getDay, getHours, isAfter, isBefore, isSameDay, isSameMonth, isValid, parseISO,
  startOfDay, startOfMonth, startOfWeek, startOfYear,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Tarefa, TarefaConcluida } from '@/lib/types'

export type Granularidade = 'dia' | 'semana' | 'mes' | 'ano'

export type FiltroPeriodo =
  | { tipo: 'intervalo'; granularidade: Granularidade; inicio: Date; fim: Date }
  | { tipo: 'diaSemana'; diaSemana: number; mesRef: Date } // 0-6, dentro do mês exibido

export function intervaloDe(granularidade: Granularidade, ref: Date): { inicio: Date; fim: Date } {
  switch (granularidade) {
    case 'dia': return { inicio: startOfDay(ref), fim: endOfDay(ref) }
    case 'semana': return { inicio: startOfWeek(ref, { weekStartsOn: 1 }), fim: endOfWeek(ref, { weekStartsOn: 1 }) }
    case 'mes': return { inicio: startOfMonth(ref), fim: endOfMonth(ref) }
    case 'ano': return { inicio: startOfYear(ref), fim: endOfYear(ref) }
  }
}

export function navegar(granularidade: Granularidade, ref: Date, direcao: 1 | -1): Date {
  switch (granularidade) {
    case 'dia': return addDays(ref, direcao)
    case 'semana': return addWeeks(ref, direcao)
    case 'mes': return addMonths(ref, direcao)
    case 'ano': return addYears(ref, direcao)
  }
}

export function dataDentroDoFiltro(d: Date, f: FiltroPeriodo): boolean {
  if (f.tipo === 'intervalo') return !isBefore(d, f.inicio) && !isAfter(d, f.fim)
  return isSameMonth(d, f.mesRef) && getDay(d) === f.diaSemana
}

// Todo dia coberto pelo filtro (intervalo -> todo dia do intervalo; dia da
// semana -> só as datas daquele dia da semana, dentro do mês exibido).
export function datasDoFiltro(f: FiltroPeriodo): Date[] {
  if (f.tipo === 'diaSemana') {
    return eachDayOfInterval({ start: startOfMonth(f.mesRef), end: endOfMonth(f.mesRef) }).filter(d => getDay(d) === f.diaSemana)
  }
  return eachDayOfInterval({ start: f.inicio, end: f.fim })
}

const capitaliza = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const NOMES_DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function labelDoFiltro(f: FiltroPeriodo): string {
  if (f.tipo === 'diaSemana') {
    return `Todas as ${NOMES_DIA_SEMANA[f.diaSemana]}s de ${format(f.mesRef, 'MMMM yyyy', { locale: ptBR })}`
  }
  switch (f.granularidade) {
    case 'dia': return capitaliza(format(f.inicio, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }))
    case 'semana': return `Semana de ${format(f.inicio, 'dd/MM')} a ${format(f.fim, 'dd/MM')}`
    case 'mes': return capitaliza(format(f.inicio, 'MMMM yyyy', { locale: ptBR }))
    case 'ano': return format(f.inicio, 'yyyy')
  }
}

const dataDe = (r: TarefaConcluida): Date | null => (isValid(parseISO(r.concluida_em)) ? parseISO(r.concluida_em) : null)

// Bucket do gráfico "Conclusões por período" — substitui o antigo calcPorDia
// (que só suportava "últimos N dias"), adaptando a granularidade do bucket ao
// filtro escolhido (hora a hora no modo Dia, dia a dia em Semana/Mês/dia da
// semana, mês a mês em Ano).
export function calcPorPeriodo(regs: TarefaConcluida[], f: FiltroPeriodo): { chave: string; label: string; qtd: number }[] {
  const datas = regs.map(dataDe).filter((d): d is Date => d !== null)

  if (f.tipo === 'diaSemana') {
    return datasDoFiltro(f).map(d => ({
      chave: format(d, 'yyyy-MM-dd'), label: format(d, 'dd/MM'),
      qtd: datas.filter(x => isSameDay(x, d)).length,
    }))
  }

  if (f.granularidade === 'dia') {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ chave: String(h), label: `${String(h).padStart(2, '0')}h`, qtd: 0 }))
    for (const d of datas) { if (isSameDay(d, f.inicio)) buckets[getHours(d)].qtd++ }
    return buckets
  }
  if (f.granularidade === 'ano') {
    return eachMonthOfInterval({ start: f.inicio, end: f.fim }).map(m => ({
      chave: format(m, 'yyyy-MM'), label: capitaliza(format(m, 'MMM', { locale: ptBR })),
      qtd: datas.filter(x => isSameMonth(x, m)).length,
    }))
  }
  // semana / mês: 1 bucket por dia do intervalo.
  return eachDayOfInterval({ start: f.inicio, end: f.fim }).map(d => ({
    chave: format(d, 'yyyy-MM-dd'), label: format(d, 'dd/MM'),
    qtd: datas.filter(x => isSameDay(x, d)).length,
  }))
}

// Quando a recorrência da tarefa é MAIS FREQUENTE que a granularidade
// escolhida (ex.: diária vista em Mês/Ano, semanal vista em Ano), um selo
// binário "Feita"/"Não feita" mascara quantos dias/semanas/meses realmente
// faltaram. Nesses casos retorna a taxa de conclusão real; retorna null
// quando a recorrência já casa 1:1 com a granularidade (aí o chamador usa o
// selo binário simples, como hoje).
export function taxaConclusao(
  tarefa: Tarefa, concluidas: TarefaConcluida[], f: FiltroPeriodo,
): { feitas: number; esperadas: number } | null {
  if (tarefa.recorrencia === 'nenhuma') return null
  const match1a1 = f.tipo === 'intervalo' && (
    (f.granularidade === 'dia' && tarefa.recorrencia === 'diaria')
    || (f.granularidade === 'semana' && tarefa.recorrencia === 'semanal')
    || (f.granularidade === 'mes' && tarefa.recorrencia === 'mensal')
  )
  if (match1a1) return null

  const concluidasDaTarefa = concluidas.filter(r => r.tarefa_id === tarefa.id && isValid(parseISO(r.concluida_em)))
  const feitoEm = (d: Date) => concluidasDaTarefa.some(r => isSameDay(parseISO(r.concluida_em), d))
  const dias = datasDoFiltro(f)

  if (tarefa.recorrencia === 'diaria') {
    return { esperadas: dias.length, feitas: dias.filter(feitoEm).length }
  }

  const chaveGrupo = tarefa.recorrencia === 'semanal'
    ? (d: Date) => format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    : (d: Date) => format(d, 'yyyy-MM')
  const grupos = new Map<string, Date[]>()
  for (const d of dias) {
    const k = chaveGrupo(d)
    const arr = grupos.get(k)
    if (arr) arr.push(d); else grupos.set(k, [d])
  }
  const listas = [...grupos.values()]
  return { esperadas: listas.length, feitas: listas.filter(g => g.some(feitoEm)).length }
}
