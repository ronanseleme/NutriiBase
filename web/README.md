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
- [x] Fase 3 — Alimentação (Geral + por refeição, base/manual/IA, IA de refeição
      completa, gramas recalculando macros, editar/excluir)
- [x] Fase 4 — Treino (registrar/editar/excluir, duração+intensidade ou
      distância+pace para corrida, gasto estimado em tempo real)
- [x] Fase 5 — Metas (KPI peso/gordura compartilhado com o Painel, barra de
      progresso, metas de peso/gordura/data, memória de cálculo de
      kcal e macros, meta de treinos semanais)
- [ ] Fase 6 — Chat IA / Insights
- [ ] Deploy: build estático + GitHub Actions para GitHub Pages

Painel, Alimentação e Treino já compartilham a navegação de data (‹ Hoje ›)
e a barra de abas — Chat IA/Insights mostram um aviso "em construção" até
serem implementadas. O gráfico mensal/anual de gasto por treino do app
original ainda não foi portado (fica para uma passada futura).
