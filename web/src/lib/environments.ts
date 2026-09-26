// Admin > Ambientes: consulta a versão/build publicada em PRD e DEV.
//
// Cada ambiente é um deploy Vercel separado do mesmo projeto (nutrii-base),
// e cada build emite um version.json público (ver vite.config.ts) com a
// versão do package.json e o horário do build. Buscamos os dois via URL
// absoluta (mesmo o "nosso", pra manter a lógica igual em ambos) — o de
// DEV usa o alias fixo `git-development` da Vercel, que sempre aponta pro
// último deploy daquela branch.
export interface EnvironmentInfo {
  key: 'production' | 'development'
  label: string
  url: string
  online: boolean
  version: string | null
  buildTime: string | null
  error: string | null
}

const ENVIRONMENTS: { key: EnvironmentInfo['key']; label: string; url: string }[] = [
  { key: 'production', label: 'Produção', url: 'https://api.nutriibase.com.br' },
  { key: 'development', label: 'Desenvolvimento', url: 'https://nutrii-base-git-development-ronanseleme.vercel.app' },
]

async function fetchOne(env: (typeof ENVIRONMENTS)[number]): Promise<EnvironmentInfo> {
  try {
    const res = await fetch(`${env.url}/version.json`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { version?: string; buildTime?: string }
    if (!data.version) throw new Error('Resposta sem versão.')
    return { ...env, online: true, version: data.version, buildTime: data.buildTime ?? null, error: null }
  } catch (err) {
    return {
      ...env,
      online: false,
      version: null,
      buildTime: null,
      error: err instanceof Error ? err.message : 'Não foi possível consultar.',
    }
  }
}

export async function fetchEnvironmentsStatus(): Promise<EnvironmentInfo[]> {
  return Promise.all(ENVIRONMENTS.map(fetchOne))
}
