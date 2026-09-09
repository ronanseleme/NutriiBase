# NutriiBase — React (em construção)

Reescrita do app em React + TypeScript + Vite + Tailwind CSS, mantendo o
mesmo projeto Supabase (schema, RLS, Edge Function) do app original
(`index.html` na raiz do repositório, que continua no ar normalmente
enquanto esta versão é construída).

## Rodando localmente

```bash
cd web
npm install
cp .env.example .env.local   # preencha com as credenciais do Supabase
npm run dev
```

## Variáveis de ambiente

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL do Supabase |
| `VITE_SUPABASE_ANON_KEY` | Publishable/anon key do Supabase |

Nunca a Secret Key do Supabase, nem a chave da Anthropic — essas ficam
só no lado do servidor (Supabase Edge Function `describe-meal`).

## Status

- [x] Fase 1 — Auth (login/cadastro, gating, logout)
- [x] Fase 2 — Painel (perfil, balanço do dia, macros, peso/gordura do dia)
- [ ] Fase 3 — Alimentação
- [ ] Fase 4 — Treino
- [ ] Fase 5 — Metas
- [ ] Fase 6 — Chat IA / Insights
- [ ] Deploy: build estático + GitHub Actions para GitHub Pages

Nota: a Fase 2 ainda não tem navegação de data (o Painel mostra sempre
o dia de hoje) — isso entra numa próxima passada, junto com Alimentação
e Treino, que também dependem de navegar entre dias.
