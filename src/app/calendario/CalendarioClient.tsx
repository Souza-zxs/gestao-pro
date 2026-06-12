'use client'

import { useEffect, useState } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import {
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  format, addMonths, subMonths, isToday, parseISO, isSameDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Agendamento, HorarioDisponivel, Bloqueio } from '@/lib/types'
import {
  PageHeader, Card, Tabs, Modal, Field, Input, Button, EmptyState, Th,
  AddButton, IconAction, RowActions,
} from '@/components/ui'
import { IconChevronLeft, IconChevronRight, IconLink, IconBan, IconTrash, IconClock } from '@/components/icons'

type Aba = 'agenda' | 'horarios' | 'bloqueios'
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS_SEMANA_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function CalendarioClient() {
  const [aba, setAba] = useState<Aba>('agenda')
  const [mesSel, setMesSel] = useState(new Date())
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [horarios, setHorarios] = useState<(HorarioDisponivel & { id?: string })[]>([])
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([])
  const [diaSel, setDiaSel] = useState<Date | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [formAgend, setFormAgend] = useState({ cliente_nome: '', horario: '' })
  const [novoBloqueio, setNovoBloqueio] = useState({ data: '', motivo: '' })
  const [showBloqueioModal, setShowBloqueioModal] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => { loadAgendamentos() }, [mesSel])
  useEffect(() => { if (aba === 'horarios') loadHorarios() }, [aba])
  useEffect(() => { if (aba === 'bloqueios') loadBloqueios() }, [aba])

  function loadAgendamentos() {
    const inicio = startOfMonth(mesSel), fim = endOfMonth(mesSel)
    setAgendamentos(getAll<Agendamento>('agendamentos').filter(a => { const d = parseISO(a.data); return d >= inicio && d <= fim }))
  }
  function loadHorarios() {
    const saved = getAll<HorarioDisponivel & { id: string }>('horarios_disponiveis')
    setHorarios(DIAS_SEMANA.map((_, i) => saved.find(h => h.dia_semana === i) || { dia_semana: i, hora_inicio: '08:00', hora_fim: '18:00', ativo: false, user_id: 'local' }))
  }
  function loadBloqueios() { setBloqueios(getAll<Bloqueio>('bloqueios')) }

  function salvarAgendamento(e: React.FormEvent) {
    e.preventDefault()
    if (!diaSel) return
    insert('agendamentos', { user_id: 'local', cliente_nome: formAgend.cliente_nome, data: format(diaSel, 'yyyy-MM-dd'), horario: formAgend.horario, status: 'confirmado' })
    setShowModal(false); setFormAgend({ cliente_nome: '', horario: '' }); loadAgendamentos()
  }
  function cancelarAgendamento(id: string) { update<Agendamento>('agendamentos', id, { status: 'cancelado' }); loadAgendamentos() }

  function salvarHorario(h: HorarioDisponivel & { id?: string }) {
    const saved = getAll<HorarioDisponivel & { id: string }>('horarios_disponiveis')
    const existing = saved.find(s => s.dia_semana === h.dia_semana)
    if (existing) update<HorarioDisponivel & { id: string }>('horarios_disponiveis', existing.id, { hora_inicio: h.hora_inicio, hora_fim: h.hora_fim, ativo: h.ativo })
    else insert('horarios_disponiveis', { ...h, user_id: 'local' })
    loadHorarios()
  }
  function toggleHorario(idx: number, field: string, value: string | boolean) {
    setHorarios(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
  }
  function adicionarBloqueio(e: React.FormEvent) {
    e.preventDefault()
    insert('bloqueios', { ...novoBloqueio, user_id: 'local' })
    setNovoBloqueio({ data: '', motivo: '' }); setShowBloqueioModal(false); loadBloqueios()
  }
  function removerBloqueio(id: string) { remove('bloqueios', id); loadBloqueios() }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/agendar/local`)
    setCopiado(true); setTimeout(() => setCopiado(false), 2000)
  }

  const diasDoMes = eachDayOfInterval({ start: startOfMonth(mesSel), end: endOfMonth(mesSel) })
  const diasVazios = Array(getDay(startOfMonth(mesSel))).fill(null)
  const agendDoDia = (date: Date) => agendamentos.filter(a => isSameDay(parseISO(a.data), date) && a.status !== 'cancelado')

  return (
    <div>
      <PageHeader
        title="Calendário"
        subtitle="Agenda, horários de atendimento e bloqueios"
        action={
          aba === 'agenda' ? (
            <Button variant="secondary" icon={<IconLink className="w-4 h-4" />} onClick={copyLink}>
              {copiado ? 'Link copiado!' : 'Copiar link público'}
            </Button>
          ) : aba === 'bloqueios' ? (
            <AddButton onClick={() => setShowBloqueioModal(true)}>Bloquear Data</AddButton>
          ) : undefined
        }
      />

      <Tabs active={aba} onChange={setAba} tabs={[
        { value: 'agenda', label: 'Agenda' },
        { value: 'horarios', label: 'Horários' },
        { value: 'bloqueios', label: 'Bloqueios' },
      ]} />

      {/* AGENDA */}
      {aba === 'agenda' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMesSel(subMonths(mesSel, 1))} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"><IconChevronLeft className="w-4 h-4" /></button>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-900 capitalize">{format(mesSel, 'MMMM yyyy', { locale: ptBR })}</span>
              <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={() => setMesSel(new Date())}>Hoje</Button>
            </div>
            <button onClick={() => setMesSel(addMonths(mesSel, 1))} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"><IconChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DIAS_SEMANA.map(d => <div key={d} className="text-center text-xs font-semibold py-2 text-gray-500">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {diasVazios.map((_, i) => <div key={`v-${i}`} />)}
            {diasDoMes.map(dia => {
              const ags = agendDoDia(dia)
              const today = isToday(dia)
              return (
                <button key={dia.toISOString()} onClick={() => { setDiaSel(dia); setShowModal(true) }}
                  className={`min-h-[72px] p-1.5 rounded-lg text-left transition-colors hover:bg-blue-50 border ${
                    today ? 'border-blue-600 bg-blue-50' : 'border-gray-100 bg-gray-50'
                  }`}>
                  <p className={`text-xs font-medium mb-1 ${today ? 'text-blue-600' : 'text-gray-700'}`}>{format(dia, 'd')}</p>
                  {ags.slice(0, 2).map(a => (
                    <div key={a.id} className="text-xs px-1 py-0.5 rounded mb-0.5 truncate bg-blue-100 text-blue-700">{a.horario} {a.cliente_nome}</div>
                  ))}
                  {ags.length > 2 && <p className="text-xs text-gray-500">+{ags.length - 2}</p>}
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* HORÁRIOS */}
      {aba === 'horarios' && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Horários de atendimento</h3>
          <p className="text-sm text-gray-500 mb-4">Defina os dias e faixas de horário disponíveis para agendamento público.</p>
          <div className="space-y-2.5">
            {horarios.map((h, i) => (
              <div key={i} className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${h.ativo ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100'}`}>
                <input type="checkbox" checked={h.ativo} onChange={e => toggleHorario(i, 'ativo', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <span className="w-20 text-sm font-medium text-gray-700">{DIAS_SEMANA_FULL[h.dia_semana]}</span>
                <Input type="time" value={h.hora_inicio} disabled={!h.ativo} onChange={e => toggleHorario(i, 'hora_inicio', e.target.value)} className="!w-auto !py-1.5" />
                <span className="text-sm text-gray-400">até</span>
                <Input type="time" value={h.hora_fim} disabled={!h.ativo} onChange={e => toggleHorario(i, 'hora_fim', e.target.value)} className="!w-auto !py-1.5" />
                <Button className="ml-auto !px-3 !py-1.5 !text-xs" onClick={() => salvarHorario(h)}>Salvar</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* BLOQUEIOS */}
      {aba === 'bloqueios' && (
        bloqueios.length === 0 ? (
          <EmptyState icon={<IconBan className="w-6 h-6" />} title="Nenhuma data bloqueada" description="Bloqueie feriados, viagens ou dias sem atendimento." action={<AddButton onClick={() => setShowBloqueioModal(true)}>Bloquear Data</AddButton>} />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr><Th>Data</Th><Th>Motivo</Th><Th className="text-right">Ações</Th></tr>
              </thead>
              <tbody>
                {bloqueios.map((b, i, arr) => (
                  <tr key={b.id} className={i < arr.length - 1 ? 'border-b border-gray-50' : ''}>
                    <td className="px-4 py-3 text-gray-900">{format(parseISO(b.data), 'dd/MM/yyyy')}</td>
                    <td className="px-4 py-3 text-gray-500">{b.motivo || '—'}</td>
                    <td className="px-4 py-3"><RowActions><IconAction onClick={() => removerBloqueio(b.id)} title="Remover" color="red"><IconTrash className="w-4 h-4" /></IconAction></RowActions></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      {/* Modal agendamento */}
      <Modal open={showModal && !!diaSel} onClose={() => setShowModal(false)} title={diaSel ? format(diaSel, "dd 'de' MMMM", { locale: ptBR }) : ''}>
        {diaSel && (
          <>
            {agendDoDia(diaSel).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Agendamentos do dia</p>
                <div className="space-y-1.5">
                  {agendDoDia(diaSel).map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <span className="text-sm flex items-center gap-1.5 text-gray-700"><IconClock className="w-3.5 h-3.5 text-gray-400" />{a.horario} — {a.cliente_nome}</span>
                      <button onClick={() => cancelarAgendamento(a.id)} className="text-xs px-2 py-0.5 rounded text-red-600 hover:bg-red-50">Cancelar</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <form onSubmit={salvarAgendamento} className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Novo agendamento</p>
              <Input required value={formAgend.cliente_nome} onChange={e => setFormAgend(p => ({ ...p, cliente_nome: e.target.value }))} placeholder="Nome do cliente" />
              <Input type="time" required value={formAgend.horario} onChange={e => setFormAgend(p => ({ ...p, horario: e.target.value }))} />
              <Button type="submit" className="w-full">Agendar</Button>
            </form>
          </>
        )}
      </Modal>

      {/* Modal bloqueio */}
      <Modal open={showBloqueioModal} onClose={() => setShowBloqueioModal(false)} title="Bloquear Data">
        <form onSubmit={adicionarBloqueio} className="space-y-4">
          <Field label="Data"><Input type="date" required value={novoBloqueio.data} onChange={e => setNovoBloqueio(p => ({ ...p, data: e.target.value }))} /></Field>
          <Field label="Motivo (opcional)"><Input value={novoBloqueio.motivo} onChange={e => setNovoBloqueio(p => ({ ...p, motivo: e.target.value }))} placeholder="Ex: Feriado, Viagem..." /></Field>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowBloqueioModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1">Bloquear</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
