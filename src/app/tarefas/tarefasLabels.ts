import type { Tarefa } from '@/lib/types'

// Fonte única do rótulo de prioridade — "Urgências" na UI usa "Urgente" pra
// alta, não "Alta". Cor fica em cada arquivo (Badge color-name vs hex vs
// classe Tailwind têm formatos diferentes por consumidor).
export const PRIO_LABEL: Record<Tarefa['prioridade'], string> = {
  alta: 'Urgente', media: 'Média', baixa: 'Baixa',
}

// Opções de status organizacional (tarefa concluída "some" — não é um valor
// escolhível aqui, ver concluirTarefa em tarefasAcoes.ts).
export const STATUS_OPCOES: { key: Exclude<Tarefa['status'], 'concluida'>; label: string }[] = [
  { key: 'a_fazer', label: 'A fazer' },
  { key: 'fazendo', label: 'Fazendo' },
  { key: 'adiado', label: 'Adiado' },
]
