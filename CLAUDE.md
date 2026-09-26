# Notas operacionais

- Ambientes: existem DEV e PRD separados, e toda alteração — código ou
  banco — segue o fluxo DEV → aprovação → PRD. Nunca aplique nada direto
  em produção sem passar por isso primeiro.
  - Código (`web/`, `supabase/functions/`): trabalhe na branch
    `development` (ou numa branch derivada dela), abra PR pra `main`. O
    deploy das Edge Functions pra produção só roda depois de aprovação
    manual no ambiente `Production` do GitHub (Settings > Environments,
    reviewer: `ronanseleme`) — confirmado funcionando em 2026-09-26.
  - Banco de dados (DDL/schema): **nunca** rode `apply_migration` contra o
    projeto de produção (`NutriiBase_Project`, id `yvsqvvjrprovcpfqmevh`).
    Rode primeiro contra a branch de dev do Supabase Branching — pegue o
    `project_ref` atual dela com `mcp__Supabase__list_branches` (ele pode
    mudar se a branch for recriada; no momento desta nota é
    `iqgefzmkazzdtqrcudwh`). Só depois de validar lá, promova pra produção
    com `mcp__Supabase__merge_branch`. Peça confirmação explícita ao
    usuário antes desse merge_branch, já que ele altera produção de fato.
  - `execute_sql` é só pra leitura/diagnóstico (SELECT), em qualquer
    ambiente; não usar pra DDL, senão o schema diverge do que está
    versionado (foi o que aconteceu com `pix_orders` antes desta nota
    existir).
- Toda mudança de schema (DDL) também precisa virar um arquivo em
  `supabase/migrations/` neste repositório (commitado junto), com o mesmo
  nome/versão que o MCP registrou — é assim que o Supabase Branching
  consegue recriar o schema de produção em ambientes de teste.
