'use client'

import { useEffect, useState } from 'react'
import { getAll, insert, update, remove, upsert } from '@/lib/store'
import { differenceInDays, parseISO, addYears, format } from 'date-fns'
import type { Colaborador, FaltasHoras } from '@/lib/types'
import {
  PageHeader, Card, Tabs, Metric, Modal, Field, Input, Select, Badge,
  EmptyState, Th, AddButton, Button, RowActions, IconAction,
} from '@/components/ui'
import { IconUsers, IconEdit, IconTrash, IconCheck } from '@/components/icons'

type Aba = 'equipe' | 'pagamentos' | 'configuracoes'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

interface FaltasHorasLocal extends FaltasHoras { id: string }

export default function ColaboradoresClient() {
  const [aba, setAba] = useState<Aba>('equipe')
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Colaborador | null>(null)
  const [form, setForm] = useState<Omit<Colaborador, 'id' | 'user_id' | 'criado_em'>>({
    nome: '', tipo_contrato: 'CLT', data_admissao: '', salario_base: 0, vt: 0, vr: 0, va: 0, convenio: 0,
  })
  const now = new Date()
  const [mesSel, setMesSel] = useState(now.getMonth() + 1)
  const [anoSel, setAnoSel] = useState(now.getFullYear())
  const [faltasHoras, setFaltasHoras] = useState<Record<string, FaltasHorasLocal>>({})
  const [diaPagamento, setDiaPagamento] = useState(5)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configSalvo, setConfigSalvo] = useState(false)

  useEffect(() => { loadColaboradores() }, [])
  useEffect(() => { if (aba === 'pagamentos') loadFaltasHoras() }, [aba, mesSel, anoSel, colaboradores])
  useEffect(() => { if (aba === 'configuracoes') loadConfig() }, [aba])

  async function loadColaboradores() { setColaboradores(await getAll<Colaborador>('colaboradores')) }

  async function loadFaltasHoras() {
    const map: Record<string, FaltasHorasLocal> = {}
    const todas = await getAll<FaltasHorasLocal>('faltas_horas', { order: null })
    todas
      .filter(f => f.mes === mesSel && f.ano === anoSel)
      .forEach(f => { map[f.colaborador_id] = f })
    setFaltasHoras(map)
  }

  async function loadConfig() {
    const cfg = await getAll<{ dia_pagamento: number }>('pagamentos_config', { order: null })
    if (cfg.length > 0) setDiaPagamento(cfg[0].dia_pagamento)
  }

  async function saveConfig() {
    setSavingConfig(true)
    try {
      await upsert('pagamentos_config', { dia_pagamento: diaPagamento }, 'user_id')
      setConfigSalvo(true); setTimeout(() => setConfigSalvo(false), 2000)
    } finally {
      setSavingConfig(false)
    }
  }

  async function salvarColaborador(e: React.FormEvent) {
    e.preventDefault()
    if (editando) await update<Colaborador>('colaboradores', editando.id, form)
    else await insert('colaboradores', form)
    setShowModal(false); setEditando(null); resetForm(); await loadColaboradores()
  }

  async function excluirColaborador(id: string) {
    if (!confirm('Excluir colaborador?')) return
    await remove('colaboradores', id); await loadColaboradores()
  }

  function resetForm() {
    setForm({ nome: '', tipo_contrato: 'CLT', data_admissao: '', salario_base: 0, vt: 0, vr: 0, va: 0, convenio: 0 })
  }

  function abrirEditar(c: Colaborador) {
    setEditando(c)
    setForm({ nome: c.nome, tipo_contrato: c.tipo_contrato, data_admissao: c.data_admissao, salario_base: c.salario_base, vt: c.vt, vr: c.vr, va: c.va, convenio: c.convenio })
    setShowModal(true)
  }

  function diasAteFerias(dataAdmissao: string) {
    const admissao = parseISO(dataAdmissao)
    const anos = Math.ceil(differenceInDays(new Date(), admissao) / 365)
    return differenceInDays(addYears(admissao, anos), new Date())
  }

  async function updateFaltasHoras(colaboradorId: string, campo: 'faltas' | 'horas_extras', delta: number) {
    const all = await getAll<FaltasHorasLocal>('faltas_horas', { order: null })
    const existing = all.find(f => f.colaborador_id === colaboradorId && f.mes === mesSel && f.ano === anoSel)
    const novoValor = Math.max(0, (existing?.[campo] || 0) + delta)
    if (existing) await update<FaltasHorasLocal>('faltas_horas', existing.id, { [campo]: novoValor })
    else await insert('faltas_horas', { colaborador_id: colaboradorId, mes: mesSel, ano: anoSel, faltas: campo === 'faltas' ? novoValor : 0, horas_extras: campo === 'horas_extras' ? novoValor : 0 })
    await loadFaltasHoras()
  }

  function calcularPagamento(c: Colaborador) {
    const fh = faltasHoras[c.id] || { faltas: 0, horas_extras: 0 }
    const diasNoMes = new Date(anoSel, mesSel, 0).getDate()
    const valorDia = c.salario_base / diasNoMes
    const descontoFaltas = fh.faltas * valorDia
    const adicionalHE = (c.salario_base / (diasNoMes * 8)) * 1.5 * (fh.horas_extras || 0)
    const salarioLiquido = Math.max(0, c.salario_base - descontoFaltas + adicionalHE)
    const beneficios = c.vt + c.vr + c.va + c.convenio
    return { salarioLiquido, beneficios, total: salarioLiquido + beneficios, faltas: fh.faltas, he: fh.horas_extras || 0 }
  }

  const totalFolha = colaboradores.reduce((s, c) => s + calcularPagamento(c).total, 0)
  const totalSalarios = colaboradores.reduce((s, c) => s + calcularPagamento(c).salarioLiquido, 0)
  const totalBeneficios = colaboradores.reduce((s, c) => s + calcularPagamento(c).beneficios, 0)
  const totalVT = colaboradores.reduce((s, c) => s + c.vt, 0)

  const Stepper = ({ value, onMinus, onPlus }: { value: number; onMinus: () => void; onPlus: () => void }) => (
    <div className="flex items-center gap-1">
      <button onClick={onMinus} className="w-6 h-6 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm font-bold">−</button>
      <span className="w-5 text-center font-medium text-gray-900">{value}</span>
      <button onClick={onPlus} className="w-6 h-6 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm font-bold">+</button>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        subtitle="Equipe, folha de pagamento e configurações"
        action={aba === 'equipe' && (
          <AddButton onClick={() => { resetForm(); setEditando(null); setShowModal(true) }}>Novo Colaborador</AddButton>
        )}
      />

      <Tabs
        active={aba}
        onChange={setAba}
        tabs={[
          { value: 'equipe', label: 'Equipe' },
          { value: 'pagamentos', label: 'Pagamentos' },
          { value: 'configuracoes', label: 'Configurações' },
        ]}
      />

      {/* EQUIPE */}
      {aba === 'equipe' && (
        colaboradores.length === 0 ? (
          <EmptyState
            icon={<IconUsers className="w-6 h-6" />}
            title="Nenhum colaborador cadastrado"
            description="Adicione membros da equipe com contrato, salário e benefícios."
            action={<AddButton onClick={() => { resetForm(); setEditando(null); setShowModal(true) }}>Novo Colaborador</AddButton>}
          />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800">
                  <tr><Th>Nome</Th><Th>Contrato</Th><Th>Admissão</Th><Th>Salário Base</Th><Th>Total</Th><Th>Férias</Th><Th className="text-right">Ações</Th></tr>
                </thead>
                <tbody>
                  {colaboradores.map((c, i, arr) => {
                    const diasFerias = diasAteFerias(c.data_admissao)
                    const total = c.salario_base + c.vt + c.vr + c.va + c.convenio
                    return (
                      <tr key={c.id} className={i < arr.length - 1 ? 'border-b border-gray-50' : ''}>
                        <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                        <td className="px-4 py-3"><Badge color={c.tipo_contrato === 'CLT' ? 'blue' : 'green'}>{c.tipo_contrato}</Badge></td>
                        <td className="px-4 py-3 text-gray-500">{format(parseISO(c.data_admissao), 'dd/MM/yyyy')}</td>
                        <td className="px-4 py-3 text-gray-700">R$ {c.salario_base.toFixed(2)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">R$ {total.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {diasFerias <= 30
                            ? <Badge color="red">{diasFerias}d ⚠</Badge>
                            : <span className="text-xs text-gray-500">{diasFerias}d</span>}
                        </td>
                        <td className="px-4 py-3">
                          <RowActions>
                            <IconAction onClick={() => abrirEditar(c)} title="Editar" color="blue"><IconEdit className="w-4 h-4" /></IconAction>
                            <IconAction onClick={() => excluirColaborador(c.id)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>
                          </RowActions>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* PAGAMENTOS */}
      {aba === 'pagamentos' && (
        <div>
          <div className="flex gap-3 mb-6">
            <Select value={mesSel} onChange={e => setMesSel(+e.target.value)} className="!w-auto">
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
            <Select value={anoSel} onChange={e => setAnoSel(+e.target.value)} className="!w-auto">
              {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Metric label="Salários" value={`R$ ${totalSalarios.toFixed(2)}`} />
            <Metric label="Benefícios" value={`R$ ${totalBeneficios.toFixed(2)}`} />
            <Metric label="VT Total" value={`R$ ${totalVT.toFixed(2)}`} />
            <Metric label="Total Folha" value={`R$ ${totalFolha.toFixed(2)}`} accent="text-blue-600" />
          </div>

          {colaboradores.length === 0 ? (
            <EmptyState icon={<IconUsers className="w-6 h-6" />} title="Sem colaboradores" description="Cadastre colaboradores na aba Equipe para gerar a folha." />
          ) : (
            <Card padded={false} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800">
                    <tr><Th>Colaborador</Th><Th>Sal. Líquido</Th><Th>VT</Th><Th>VR</Th><Th>VA</Th><Th>Convênio</Th><Th>Faltas</Th><Th>H. Extras</Th><Th>Total</Th></tr>
                  </thead>
                  <tbody>
                    {colaboradores.map((c, i, arr) => {
                      const p = calcularPagamento(c)
                      return (
                        <tr key={c.id} className={i < arr.length - 1 ? 'border-b border-gray-50' : ''}>
                          <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                          <td className="px-4 py-3 text-gray-700">R$ {p.salarioLiquido.toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-700">R$ {c.vt.toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-700">R$ {c.vr.toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-700">R$ {c.va.toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-700">R$ {c.convenio.toFixed(2)}</td>
                          <td className="px-4 py-3"><Stepper value={p.faltas} onMinus={() => updateFaltasHoras(c.id, 'faltas', -1)} onPlus={() => updateFaltasHoras(c.id, 'faltas', 1)} /></td>
                          <td className="px-4 py-3"><Stepper value={p.he} onMinus={() => updateFaltasHoras(c.id, 'horas_extras', -1)} onPlus={() => updateFaltasHoras(c.id, 'horas_extras', 1)} /></td>
                          <td className="px-4 py-3 font-bold text-blue-600">R$ {p.total.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* CONFIGURAÇÕES */}
      {aba === 'configuracoes' && (
        <Card className="max-w-md">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Configurações de Pagamento</h3>
          <div className="space-y-4">
            <Field label="Dia padrão de pagamento" hint={`Salários pagos todo dia ${diaPagamento}`}>
              <Input type="number" min={1} max={31} value={diaPagamento} onChange={e => setDiaPagamento(+e.target.value)} className="!w-24" />
            </Field>
            <div className="flex items-center gap-3">
              <Button onClick={saveConfig} disabled={savingConfig}>{savingConfig ? 'Salvando...' : 'Salvar configuração'}</Button>
              {configSalvo && <span className="flex items-center gap-1 text-sm text-green-600"><IconCheck className="w-4 h-4" /> Salvo</span>}
            </div>
          </div>
        </Card>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditando(null) }} title={`${editando ? 'Editar' : 'Novo'} Colaborador`} size="lg">
        <form onSubmit={salvarColaborador} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Nome"><Input required value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" /></Field>
            </div>
            <Field label="Tipo de Contrato">
              <Select value={form.tipo_contrato} onChange={e => setForm(p => ({ ...p, tipo_contrato: e.target.value as 'CLT' | 'PJ' }))}>
                <option value="CLT">CLT</option><option value="PJ">PJ</option>
              </Select>
            </Field>
            <Field label="Data de Admissão"><Input type="date" required value={form.data_admissao} onChange={e => setForm(p => ({ ...p, data_admissao: e.target.value }))} /></Field>
            <Field label="Salário Base (R$)"><Input type="number" required min={0} step="0.01" value={form.salario_base} onChange={e => setForm(p => ({ ...p, salario_base: +e.target.value }))} /></Field>
            {(['vt', 'vr', 'va', 'convenio'] as const).map(campo => (
              <Field key={campo} label={`${campo === 'convenio' ? 'Convênio' : campo.toUpperCase()} (R$)`}>
                <Input type="number" min={0} step="0.01" value={form[campo]} onChange={e => setForm(p => ({ ...p, [campo]: +e.target.value }))} />
              </Field>
            ))}
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowModal(false); setEditando(null) }}>Cancelar</Button>
            <Button type="submit" className="flex-1">{editando ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
