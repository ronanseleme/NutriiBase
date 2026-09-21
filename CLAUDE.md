# Notas operacionais

- Supabase: o MCP `mcp__Supabase__*` já está conectado ao projeto real
  (`NutriiBase_Project`, id `yvsqvvjrprovcpfqmevh`). Ao invés de pedir
  pro usuário colar SQL no SQL Editor do dashboard, use
  `mcp__Supabase__apply_migration` / `execute_sql` pra rodar direto.
  Só peça pra ele rodar manualmente se o MCP falhar ou pedir confirmação
  explícita antes de uma alteração arriscada.
