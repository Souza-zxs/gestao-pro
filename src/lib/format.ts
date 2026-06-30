// Formatação compartilhada (BR)

export function brl(valor: number): string {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Formata um número como valor BR SEM o símbolo (ex: 1500.5 => "1.500,50").
export function valorBR(n: number): string {
  return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Converte o texto digitado pelo usuário em número, no padrão brasileiro.
 * Aceita tanto número puro quanto separadores:
 *   "1500"      -> 1500       (número puro vira reais; o , e . aparecem na exibição)
 *   "1.500"     -> 1500       (ponto = milhar)
 *   "1500,50"   -> 1500.5     (vírgula = decimal)
 *   "1.500,50"  -> 1500.5     (ponto = milhar, vírgula = decimal)
 *   "1500.50"   -> 1500.5     (ponto decimal isolado também é reconhecido)
 */
export function parseValorBR(str: string | number): number {
  if (typeof str === 'number') return isNaN(str) ? 0 : str
  let s = String(str).replace(/[^\d.,-]/g, '')
  if (!s) return 0
  if (s.includes(',')) {
    // vírgula é o separador decimal; pontos são milhar
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes('.')) {
    const partes = s.split('.')
    const ultima = partes[partes.length - 1]
    // um único ponto seguido de 1–2 dígitos => ponto decimal; caso contrário => milhar
    if (!(partes.length === 2 && ultima.length <= 2)) {
      s = s.replace(/\./g, '')
    }
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

export function minutosParaTexto(min?: number): string {
  if (!min) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}
