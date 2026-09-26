-- Já aplicada em produção antes deste repositório ganhar uma pasta de
-- migrations (rodada direto via MCP). Mantida aqui só para o histórico
-- local bater com supabase_migrations.schema_migrations no banco remoto —
-- o estado final já está coberto pela baseline (20260908224600).
drop function if exists public.admin_list_users();

create function public.admin_list_users()
returns table (
  id uuid,
  nome text,
  email text,
  role public.user_role_enum,
  creditos_ia int,
  creditos_mensais int,
  data_inicio_pro timestamptz,
  data_proxima_renovacao timestamptz,
  created_at timestamptz,
  ultimo_login timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas administradores podem listar usuários.';
  end if;

  return query
    select p.id, p.nome, u.email::text, p.role, p.creditos_ia, p.creditos_mensais,
           p.data_inicio_pro, p.data_proxima_renovacao, p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;
