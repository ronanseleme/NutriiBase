# Notas operacionais

- Supabase: o MCP `mcp__Supabase__*` já está conectado ao projeto real
  (`NutriiBase_Project`, id `yvsqvvjrprovcpfqmevh`). Ao invés de pedir
  pro usuário colar SQL no SQL Editor do dashboard, use
  `mcp__Supabase__apply_migration` pra rodar direto.
  Só peça pra ele rodar manualmente se o MCP falhar ou pedir confirmação
  explícita antes de uma alteração arriscada.
- Toda mudança de schema (DDL) feita via `apply_migration` também precisa
  virar um arquivo em `supabase/migrations/` neste repositório (commitado
  junto), com o mesmo nome/versão que o MCP registrou — é assim que o
  Supabase Branching consegue recriar o schema de produção em ambientes de
  teste. `execute_sql` é só pra leitura/diagnóstico (SELECT); não usar pra
  DDL, senão o schema em produção diverge do que está versionado de novo
  (foi o que aconteceu com `pix_orders` antes desta nota existir).
