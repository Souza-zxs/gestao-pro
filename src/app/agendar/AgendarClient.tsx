import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getAll, insert } from '@/lib/store'
import { format, parseISO, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { HorarioDisponivel, Bloqueio, Agendamento } from '@/lib/types'
import { Field, Input, Button } from '@/components/ui'
import { IconCheck } from '@/components/icons'

export default function AgendarPublicoPage() {
  const { userId } = useParams()
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>([])
  const [diasDisponiveis, setDiasDisponiveis] = useState<Date[]>([])
  const [diaSel, setDiaSel] = useState<string | null>(null)
  const [horarioSel, setHorarioSel] = useState<string>('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(true)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      if (!userId) { setLoading(false); return }
      const h = (await getAll<HorarioDisponivel>('horarios_disponiveis', { match: { user_id: userId }, order: null })).filter(x => x.ativo)
      const b = await getAll<Bloqueio>('bloqueios', { match: { user_id: userId } })
      setHorarios(h)

      const hoje = new Date()
      const dias: Date[] = []
      for (let i = 1; i <= 60 && dias.length < 18; i++) {
        const dia = addDays(hoje, i)
        const temHorario = h.some(hh => hh.dia_semana === dia.getDay())
        const bloqueado = b.some(bl => bl.data === format(dia, 'yyyy-MM-dd'))
        if (temHorario && !bloqueado) dias.push(dia)
      }
      setDiasDisponiveis(dias)
      setLoading(false)
    }
    carregar()
  }, [userId])

  function gerarHorarios(dia: Date) {
    const horario = horarios.find(h => h.dia_semana === dia.getDay())
    if (!horario) return []
    const slots: string[] = []
    const [hi, mi] = horario.hora_inicio.split(':').map(Number)
    const [hf, mf] = horario.hora_fim.split(':').map(Number)
    let min = hi * 60 + mi
    const fim = hf * 60 + mf
    while (min < fim) {
      slots.push(`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`)
      min += 60
    }
    return slots
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!diaSel || !horarioSel || !nome || !userId) return

    try {
      const agendados = await getAll<Agendamento>('agendamentos', { match: { user_id: userId } })
      const ocupado = agendados.some(a => a.data === diaSel && a.horario === horarioSel && a.status === 'confirmado')
      if (ocupado) { setErro('Este horário já está ocupado. Escolha outro.'); return }

      await insert('agendamentos', { user_id: userId, cliente_nome: nome, data: diaSel, horario: horarioSel, status: 'confirmado' })
      setSucesso(true)
    } catch {
      setErro('Não foi possível concluir o agendamento. Tente novamente.')
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

  if (sucesso) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full border border-gray-200 shadow-sm gp-pop">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <IconCheck className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Agendamento confirmado!</h2>
        <p className="text-sm text-gray-500">
          {nome}, seu horário em {diaSel && format(parseISO(diaSel), "dd 'de' MMMM", { locale: ptBR })} às {horarioSel} está confirmado.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen py-10 px-4 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold text-xl mb-3">G</div>
          <h1 className="text-2xl font-bold text-gray-900">Agendar Horário</h1>
          <p className="text-sm text-gray-500 mt-1">Escolha um dia e horário disponível</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          {diasDisponiveis.length === 0 ? (
            <p className="text-sm text-center py-8 text-gray-400">
              Nenhum horário disponível no momento. Configure os horários na aba Calendário.
            </p>
          ) : (
            <form onSubmit={confirmar} className="space-y-5">
              <Field label="Seu nome">
                <Input required value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
              </Field>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Escolha um dia</label>
                <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                  {diasDisponiveis.map(d => {
                    const dStr = format(d, 'yyyy-MM-dd')
                    const sel = diaSel === dStr
                    return (
                      <button type="button" key={dStr}
                        onClick={() => { setDiaSel(dStr); setHorarioSel('') }}
                        className={`p-2 rounded-xl text-center transition-colors border ${
                          sel ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-xs capitalize">{format(d, 'EEE', { locale: ptBR })}</p>
                        <p className="text-lg font-bold">{format(d, 'd')}</p>
                        <p className="text-xs text-gray-400 capitalize">{format(d, 'MMM', { locale: ptBR })}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {diaSel && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Escolha um horário</label>
                  <div className="grid grid-cols-4 gap-2">
                    {gerarHorarios(parseISO(diaSel)).map(h => (
                      <button type="button" key={h} onClick={() => setHorarioSel(h)}
                        className={`py-2 rounded-lg text-sm font-medium transition-colors border ${
                          horarioSel === h ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {erro && <div className="p-3 rounded-lg text-sm bg-red-50 text-red-600">{erro}</div>}

              <Button type="submit" disabled={!diaSel || !horarioSel || !nome} className="w-full !py-3">
                Confirmar Agendamento
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
