-- Admin > Status: uso de armazenamento.
--
-- Chamada pela Edge Function system-status pra mostrar, no painel de
-- Admin, o tamanho do banco Postgres e dos buckets do Storage — contra as
-- cotas incluídas no plano Pro do Supabase (8 GB de banco, 100 GB de
-- Storage). Admin-only, mesma defesa em profundidade das outras funções.
drop function if exists public.admin_storage_stats();

create function public.admin_storage_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  db_bytes bigint;
  buckets jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas administradores podem ver estatísticas de armazenamento.';
  end if;

  select pg_database_size(current_database()) into db_bytes;

  select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'bytes', total_bytes, 'objects', object_count) order by total_bytes desc), '[]'::jsonb)
  into buckets
  from (
    select bucket_id, sum((metadata->>'size')::bigint) as total_bytes, count(*) as object_count
    from storage.objects
    group by bucket_id
  ) t;

  return jsonb_build_object(
    'dbBytes', db_bytes,
    'buckets', buckets
  );
end;
$$;
