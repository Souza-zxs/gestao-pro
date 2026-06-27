import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getAll, insert } from '@/lib/store'
import { format, parseISO, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { HorarioDisponivel, Bloqueio, Agendamento } from '@/lib/types'
import { Field, Input, Button } from '@/components/ui'
import { IconCheck, IconCalendar, IconClock } from '@/components/icons'

/* ─────────────────────────────────────────────────────────────────────
   AgendarPublicoPage
   Página pública — sem auth, sem sidebar. Qualquer pessoa acessa via
   /agendar/:userId para marcar um horário disponível.
───────────────────────────────────────────────────────────────────── */
export default function AgendarPublicoPage() {
  const { userId } = useParams()

  // Estado da página
  const [horarios,        setHorarios]        = useState<HorarioDisponivel[]>([])
  const [diasDisponiveis, setDiasDisponiveis] = useState<Date[]>([])
  const [diaSel,          setDiaSel]          = useState<string | null>(null)
  const [horarioSel,      setHorarioSel]      = useState<string>('')
  const [nome,            setNome]            = useState('')
  const [loading,         setLoading]         = useState(true)
  const [sucesso,         setSucesso]         = useState(false)
  const [erro,            setErro]            = useState('')

  /* ── Carregar horários e calcular dias disponíveis ── */
  useEffect(() => {
    async function carregar() {
      if (!userId) { setLoading(false); return }

      const h = (await getAll<HorarioDisponivel>('horarios_disponiveis', {
        match: { user_id: userId }, order: null,
      })).filter(x => x.ativo)

      const b = await getAll<Bloqueio>('bloqueios', { match: { user_id: userId } })

      setHorarios(h)

      // Varre os próximos 60 dias e pega até 18 que tenham horário e não estejam bloqueados
      const hoje = new Date()
      const dias: Date[] = []
      for (let i = 1; i <= 60 && dias.length < 18; i++) {
        const dia      = addDays(hoje, i)
        const temSlot  = h.some(hh => hh.dia_semana === dia.getDay())
        const bloqueado = b.some(bl => bl.data === format(dia, 'yyyy-MM-dd'))
        if (temSlot && !bloqueado) dias.push(dia)
      }

      setDiasDisponiveis(dias)
      setLoading(false)
    }
    carregar()
  }, [userId])

  /* ── Gerar slots de horário para um dia selecionado ── */
  function gerarHorarios(dia: Date): string[] {
    const horario = horarios.find(h => h.dia_semana === dia.getDay())
    if (!horario) return []

    const slots: string[] = []
    const [hi, mi] = horario.hora_inicio.split(':').map(Number)
    const [hf, mf] = horario.hora_fim.split(':').map(Number)
    let min = hi * 60 + mi
    const fim = hf * 60 + mf

    while (min < fim) {
      const hh = String(Math.floor(min / 60)).padStart(2, '0')
      const mm = String(min % 60).padStart(2, '0')
      slots.push(`${hh}:${mm}`)
      min += 60
    }
    return slots
  }

  /* ── Confirmar agendamento ── */
  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!diaSel || !horarioSel || !nome || !userId) return

    try {
      const agendados = await getAll<Agendamento>('agendamentos', { match: { user_id: userId } })
      const ocupado   = agendados.some(a =>
        a.data === diaSel && a.horario === horarioSel && a.status === 'confirmado'
      )
      if (ocupado) {
        setErro('Este horário já está ocupado. Escolha outro.')
        return
      }
      await insert('agendamentos', {
        user_id: userId, cliente_nome: nome,
        data: diaSel, horario: horarioSel, status: 'confirmado',
      })
      setSucesso(true)
    } catch {
      setErro('Não foi possível concluir o agendamento. Tente novamente.')
    }
  }

  /* ── Loading ── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <p className="text-xs text-gray-400 dark:text-gray-500">Carregando horários…</p>
      </div>
    </div>
  )

  /* ── Sucesso ── */
  if (sucesso) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center max-w-sm w-full border border-gray-200 dark:border-gray-800 shadow-sm gp-pop">
        {/* Ícone de sucesso */}
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
          <IconCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>

        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
          Agendamento confirmado!
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          <span className="font-medium text-gray-700 dark:text-gray-300">{nome}</span>, seu horário em{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {diaSel && format(parseISO(diaSel), "dd 'de' MMMM", { locale: ptBR })}
          </span>{' '}
          às{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{horarioSel}</span>{' '}
          está confirmado.
        </p>

        {/* Pill de resumo */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <IconCalendar className="w-3.5 h-3.5" />
            {diaSel && format(parseISO(diaSel), "dd/MM/yyyy")}
          </div>
          <div className="w-px h-3 bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <IconClock className="w-3.5 h-3.5" />
            {horarioSel}
          </div>
        </div>
      </div>
    </div>
  )

  /* ── Página principal ── */
  return (
    <div className="min-h-screen py-10 px-4 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto">

        {/* Header da página pública */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold text-xl mb-4">
            G
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Agendar Horário
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Escolha um dia e horário disponível
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">

          {diasDisponiveis.length === 0 ? (
            <div className="p-10 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <IconCalendar className="w-5 h-5 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Nenhum horário disponível
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed">
                Configure os horários disponíveis na aba Calendário.
              </p>
            </div>
          ) : (
            <form onSubmit={confirmar}>

              {/* Nome */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <Field label="Seu nome">
                  <Input
                    required
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Nome completo"
                  />
                </Field>
              </div>

              {/* Escolha de dia */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-4">
                  <IconCalendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    Escolha um dia
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-0.5">
                  {diasDisponiveis.map(d => {
                    const dStr = format(d, 'yyyy-MM-dd')
                    const sel  = diaSel === dStr
                    return (
                      <button
                        type="button"
                        key={dStr}
                        onClick={() => { setDiaSel(dStr); setHorarioSel('') }}
                        className={`p-3 rounded-xl text-center transition-all border ${
                          sel
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                      >
                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 capitalize">
                          {format(d, 'EEE', { locale: ptBR })}
                        </p>
                        <p className={`text-xl font-bold mt-0.5 ${sel ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                          {format(d, 'd')}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">
                          {format(d, 'MMM', { locale: ptBR })}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Escolha de horário — só aparece após selecionar dia */}
              {diaSel && (
                <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-4">
                    <IconClock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                      Escolha um horário
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {gerarHorarios(parseISO(diaSel)).map(h => (
                      <button
                        type="button"
                        key={h}
                        onClick={() => setHorarioSel(h)}
                        className={`py-2.5 rounded-lg text-xs font-semibold transition-all border ${
                          horarioSel === h
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Erro */}
              {erro && (
                <div className="mx-6 mt-4 p-3 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900">
                  {erro}
                </div>
              )}

              {/* Botão de confirmação */}
              <div className="p-6">
                <Button
                  type="submit"
                  disabled={!diaSel || !horarioSel || !nome}
                  className="w-full py-3 text-sm"
                >
                  Confirmar Agendamento
                </Button>

                {/* Resumo do que foi selecionado */}
                {diaSel && horarioSel && (
                  <div className="mt-3 flex items-center justify-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <IconCalendar className="w-3 h-3" />
                      {format(parseISO(diaSel), "dd 'de' MMMM", { locale: ptBR })}
                    </span>
                    <span className="w-px h-3 bg-gray-200 dark:bg-gray-700" />
                    <span className="flex items-center gap-1">
                      <IconClock className="w-3 h-3" />
                      {horarioSel}
                    </span>
                  </div>
                )}
              </div>

            </form>
          )}
        </div>

        {/* Rodapé discreto */}
        <p className="text-center text-[10px] text-gray-300 dark:text-gray-700 mt-6">
          Powered by Gestão Pro
        </p>

      </div>
    </div>
  )
}