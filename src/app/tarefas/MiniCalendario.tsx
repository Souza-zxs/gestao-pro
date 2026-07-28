// Mini calendário (grid mensal) usado pelo filtro "Dia" do dashboard de
// análise de tarefas do admin. Componente novo e autocontido — não depende da
// página /calendario (agenda de atendimento), que é uma tela sem relação com
// tarefas.

import {
  addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, isToday, startOfMonth, subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { IconChevronLeft, IconChevronRight } from '@/components/icons'

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export default function MiniCalendario({
  mes, onMudarMes, selecionado, onSelecionar, diaSemanaDestaque,
}: {
  mes: Date
  onMudarMes: (novoMes: Date) => void
  selecionado: Date | null
  onSelecionar: (d: Date) => void
  diaSemanaDestaque: number | null
}) {
  const diasDoMes = eachDayOfInterval({ start: startOfMonth(mes), end: endOfMonth(mes) })
  const diasVazios = Array(getDay(startOfMonth(mes))).fill(null)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 w-full max-w-[300px]">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMudarMes(subMonths(mes, 1))}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <IconChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 capitalize">
          {format(mes, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button
          onClick={() => onMudarMes(addMonths(mes, 1))}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <IconChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className={`text-center text-[10.5px] font-semibold py-1 ${diaSemanaDestaque === i ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}`}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {diasVazios.map((_, i) => <div key={`v-${i}`} />)}
        {diasDoMes.map(dia => {
          const hoje = isToday(dia)
          const sel = !!selecionado && isSameDay(dia, selecionado)
          const destacado = diaSemanaDestaque !== null && getDay(dia) === diaSemanaDestaque
          return (
            <button
              key={dia.toISOString()}
              onClick={() => onSelecionar(dia)}
              className={[
                'aspect-square rounded-full text-[12px] font-medium transition-colors flex items-center justify-center',
                sel
                  ? 'bg-blue-600 text-white shadow-sm'
                  : hoje
                    ? 'ring-1 ring-inset ring-blue-500 text-blue-600 dark:text-blue-400'
                    : destacado
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
              ].join(' ')}
            >
              {format(dia, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
