# NutriiBase — React (produção)

App em React + TypeScript + Vite + Tailwind CSS, publicado no GitHub Pages
via GitHub Actions a cada push em `main` (ver
`.github/workflows/deploy-pages.yml` na raiz do repositório). Mantém o
mesmo projeto Supabase (schema, RLS, Edge Functions) desde a reescrita.
A versão anterior em HTML/JS puro foi descontinuada.

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
- [x] Fase 6 — Chat IA / Insights (uma única aba "Chat & Insights" com
      alternância interna entre os dois modos, IA via Edge Function própria)
- [x] Redesign visual — marca real (anel azul + folha verde + brilho laranja),
      paleta de cores atualizada (`--blue`, `--green`, `--orange`, gradientes),
      componentes visuais compartilhados (`nb-card`, `nb-btn-*`, `nb-input`,
      `nb-segmented`) aplicados em todas as abas, tela de login e barra
      superior com acabamento mais "digital"
- [x] Deploy: build estático + GitHub Actions para GitHub Pages (`main` é
      agora a fonte de produção; `react-rewrite` foi mesclada em `main`)

Painel, Alimentação e Treino já compartilham a navegação de data (‹ Hoje ›)
e a barra de abas. Chat IA e Insights foram unificados em uma única aba
("Chat & Insights", com um alternador Chat/Insights no topo) a pedido do
produto, em vez de duas abas separadas. O gráfico mensal/anual de gasto por
treino do app original ainda não foi portado (fica para uma passada futura).

### Chat IA / Insights

Usa uma nova Edge Function, `chat-assistant` (mesmo padrão do
`describe-meal`: autentica o usuário via Supabase e chama a Anthropic
server-side com a secret `ANTHROPIC_API_KEY`, nunca exposta no frontend).
O contexto (perfil, metas e histórico recente) é montado no cliente a
partir dos dados já carregados e enviado como texto para a função, que
devolve:
- Chat: `{ reply, chips }` — resposta + até 3 sugestões de continuação.
- Insights ("Gerar dicas personalizadas"): `{ tips: string[] }`.

As demais seções de Insights (saldo calórico do mês, peso no mês,
consistência/streak, pontos de atenção) são calculadas localmente a partir
de `refeicoes`/`treinos`/`registros_peso`, sem IA — iguais ao app original.

Deploy da função: `supabase functions deploy chat-assistant` (a secret
`ANTHROPIC_API_KEY` já configurada para o `describe-meal` é reaproveitada).

### Marca e design system

A logo é a marca real do NutriiBase — anel azul incompleto, folha verde com
nervura, brilho laranja de 4 pontas — fornecida pelo usuário como PNG e
salva em `web/public/brand/` (`logo-full.png`, `logo-mark.png`,
`logo-wordmark.png`; recortadas do espaço transparente e redimensionadas).
`web/src/components/Logo.tsx` expõe as três variantes (`full`, `mark`,
`wordmark`) como `<img>` apontando pra esses arquivos. O favicon
(`favicon-64.png`/`favicon-180.png`, mesma pasta) usa a variante `mark`.

Tokens de cor em `web/src/index.css` (`--blue`, `--green`, `--orange`,
`--teal`, `--coral` + gradientes `--brand-gradient`/`--accent-gradient`/
`--blue-gradient`) e classes compartilhadas (`nb-card`, `nb-modal`,
`nb-input`, `nb-btn` + `nb-btn-primary`/`nb-btn-blue`/`nb-btn-secondary`,
`nb-segmented`) centralizam o visual — trocar um token/classe atualiza
todas as telas de uma vez.
