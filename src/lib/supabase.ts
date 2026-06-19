// Cliente Supabase compartilhado por todo o app (gestão + portal).
// As credenciais vêm do .env.local (prefixo VITE_ é exigido pelo Vite para
// expor a variável ao código do navegador). Apenas a chave PUBLISHABLE/ANON
// fica aqui — ela respeita as policies de RLS do banco.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error(
    'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
