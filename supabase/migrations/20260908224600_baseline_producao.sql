-- Baseline de migrations do NutriiBase.
--
-- Este arquivo nasceu de uma auditoria comparando supabase/schema.sql com o
-- schema REAL rodando em produção (introspecção via pg_catalog/information_schema
-- em 2026-09-25), para permitir habilitar o Supabase Branching sem criar
-- ambientes de teste com um schema diferente do de produção.
--
-- O conteúdo é o mesmo schema.sql de sempre, com dois ajustes onde produção
-- havia divergido do arquivo (ver notas inline abaixo): a tabela pix_orders
-- e a função/event trigger rls_auto_enable. Escrito para ser idempotente
-- (if not exists / or replace / drop-then-create), então pode rodar com
-- segurança tanto em um branch novo (do zero) quanto em produção (onde a
-- maior parte já existe).
--
-- A partir de agora, qualquer mudança de schema deve virar um novo arquivo
-- em supabase/migrations/ (supabase migration new <nome>), nunca mais SQL
-- solto direto em produção — senão este arquivo volta a ficar desatualizado.

create extension if not exists pgcrypto;

-- ========== ENUMS ==========
do $$ begin
  create type nivel_atividade_enum as enum ('sedentario','leve','moderado','intenso','atleta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type objetivo_enum as enum ('emagrecimento','manutencao','ganho_massa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ritmo_enum as enum ('lento','moderado','agressivo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_refeicao_enum as enum ('cafe_da_manha','almoco','lanche','jantar','ceia','pre_treino','pos_treino');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_atividade_enum as enum ('musculacao','corrida','ciclismo','funcional','natacao','outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type intensidade_enum as enum ('leve','moderada','intensa');
exception when duplicate_object then null; end $$;

-- ========== profiles ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  idade int,
  sexo text check (sexo in ('F','M')),
  altura_cm numeric,
  peso_atual_kg numeric,
  percentual_gordura_atual numeric,
  nivel_atividade nivel_atividade_enum not null default 'moderado',
  objetivo objetivo_enum not null default 'manutencao',
  ritmo ritmo_enum not null default 'moderado',
  peso_meta_kg numeric,
  percentual_gordura_meta numeric,
  data_meta date,
  meta_treinos_semanais int,
  restricoes_alimentares text,
  meta_calorica_diaria int,
  meta_proteina_g int,
  meta_carbo_g int,
  meta_gordura_g int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- ========== papéis de acesso e créditos de IA — colunas + is_admin() ==========
do $$ begin
  create type public.user_role_enum as enum ('admin', 'pro', 'free');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists role public.user_role_enum not null default 'free',
  add column if not exists creditos_ia integer not null default 0,
  add column if not exists creditos_mensais integer not null default 50,
  add column if not exists data_inicio_pro timestamptz,
  add column if not exists data_proxima_renovacao timestamptz;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  );
$$;

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin(auth.uid()));

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if current_setting('app.bypass_profile_protection', true) = 'true' then
    return new;
  end if;
  if public.is_admin(auth.uid()) then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.creditos_ia is distinct from old.creditos_ia
     or new.creditos_mensais is distinct from old.creditos_mensais
     or new.data_inicio_pro is distinct from old.data_inicio_pro
     or new.data_proxima_renovacao is distinct from old.data_proxima_renovacao
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.licenca_avulsa_expira_em is distinct from old.licenca_avulsa_expira_em
     or new.estimativas_ia_free_hoje is distinct from old.estimativas_ia_free_hoje
     or new.estimativas_ia_free_data is distinct from old.estimativas_ia_free_data
  then
    raise exception 'Não é permitido alterar role, créditos ou dados de cobrança diretamente.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_columns on public.profiles;
create trigger profiles_protect_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

alter table public.profiles
  add column if not exists override_proteina_g int,
  add column if not exists override_gordura_g int;

alter table public.profiles
  add column if not exists meta_descricao text;

-- ========== refeicoes ==========
create table if not exists public.refeicoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  tipo_refeicao tipo_refeicao_enum not null,
  nome_alimento text not null,
  porcao numeric,
  unidade text,
  kcal numeric not null default 0,
  proteina_g numeric not null default 0,
  carboidrato_g numeric not null default 0,
  gordura_g numeric not null default 0,
  descricao_ia text,
  created_at timestamptz not null default now()
);

create index if not exists refeicoes_user_data_idx on public.refeicoes(user_id, data);

alter table public.refeicoes enable row level security;

drop policy if exists "refeicoes_insert_own" on public.refeicoes;
create policy "refeicoes_insert_own" on public.refeicoes
  for insert with check (auth.uid() = user_id);

drop policy if exists "refeicoes_update_own" on public.refeicoes;
create policy "refeicoes_update_own" on public.refeicoes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "refeicoes_delete_own" on public.refeicoes;
create policy "refeicoes_delete_own" on public.refeicoes
  for delete using (auth.uid() = user_id);

drop policy if exists "refeicoes_select_admin" on public.refeicoes;
create policy "refeicoes_select_admin" on public.refeicoes
  for select using (public.is_admin(auth.uid()));

drop policy if exists "refeicoes_update_admin" on public.refeicoes;
create policy "refeicoes_update_admin" on public.refeicoes
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ========== treinos ==========
create table if not exists public.treinos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  tipo_atividade tipo_atividade_enum not null,
  duracao_min int,
  intensidade intensidade_enum,
  distancia_km numeric,
  pace_min_km numeric,
  kcal_estimado numeric not null default 0,
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists treinos_user_data_idx on public.treinos(user_id, data);

alter table public.treinos enable row level security;

drop policy if exists "treinos_insert_own" on public.treinos;
create policy "treinos_insert_own" on public.treinos
  for insert with check (auth.uid() = user_id);

drop policy if exists "treinos_update_own" on public.treinos;
create policy "treinos_update_own" on public.treinos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "treinos_delete_own" on public.treinos;
create policy "treinos_delete_own" on public.treinos
  for delete using (auth.uid() = user_id);

drop policy if exists "treinos_select_admin" on public.treinos;
create policy "treinos_select_admin" on public.treinos
  for select using (public.is_admin(auth.uid()));

drop policy if exists "treinos_update_admin" on public.treinos;
create policy "treinos_update_admin" on public.treinos
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ========== registros_peso ==========
create table if not exists public.registros_peso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  peso_kg numeric,
  percentual_gordura numeric,
  created_at timestamptz not null default now(),
  unique (user_id, data)
);

create index if not exists registros_peso_user_data_idx on public.registros_peso(user_id, data);

alter table public.registros_peso enable row level security;

drop policy if exists "registros_peso_insert_own" on public.registros_peso;
create policy "registros_peso_insert_own" on public.registros_peso
  for insert with check (auth.uid() = user_id);

drop policy if exists "registros_peso_update_own" on public.registros_peso;
create policy "registros_peso_update_own" on public.registros_peso
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "registros_peso_delete_own" on public.registros_peso;
create policy "registros_peso_delete_own" on public.registros_peso
  for delete using (auth.uid() = user_id);

drop policy if exists "registros_peso_select_admin" on public.registros_peso;
create policy "registros_peso_select_admin" on public.registros_peso
  for select using (public.is_admin(auth.uid()));

drop policy if exists "registros_peso_update_admin" on public.registros_peso;
create policy "registros_peso_update_admin" on public.registros_peso
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ========== metas_mensais ==========
create table if not exists public.metas_mensais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mes_ano date not null,
  descricao_foco text,
  meta_peso_kg numeric,
  saldo_calorico_planejado int,
  created_at timestamptz not null default now(),
  unique (user_id, mes_ano)
);

create index if not exists metas_mensais_user_mes_idx on public.metas_mensais(user_id, mes_ano);

alter table public.metas_mensais enable row level security;

drop policy if exists "metas_mensais_select_own" on public.metas_mensais;
create policy "metas_mensais_select_own" on public.metas_mensais
  for select using (auth.uid() = user_id);

drop policy if exists "metas_mensais_insert_own" on public.metas_mensais;
create policy "metas_mensais_insert_own" on public.metas_mensais
  for insert with check (auth.uid() = user_id);

drop policy if exists "metas_mensais_update_own" on public.metas_mensais;
create policy "metas_mensais_update_own" on public.metas_mensais
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "metas_mensais_delete_own" on public.metas_mensais;
create policy "metas_mensais_delete_own" on public.metas_mensais
  for delete using (auth.uid() = user_id);

drop policy if exists "metas_mensais_select_admin" on public.metas_mensais;
create policy "metas_mensais_select_admin" on public.metas_mensais
  for select using (public.is_admin(auth.uid()));

drop policy if exists "metas_mensais_update_admin" on public.metas_mensais;
create policy "metas_mensais_update_admin" on public.metas_mensais
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ========== auto-criação de profile em todo novo usuário (e-mail ou OAuth) ==========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== transações de crédito ==========
do $$ begin
  create type public.tipo_transacao_credito_enum as enum ('consumo', 'renovacao_mensal', 'ajuste_admin');
exception when duplicate_object then null; end $$;

create table if not exists public.transacoes_creditos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo public.tipo_transacao_credito_enum not null,
  quantidade int not null,
  descricao text,
  created_at timestamptz not null default now()
);

create index if not exists transacoes_creditos_user_idx on public.transacoes_creditos(user_id, created_at desc);

alter table public.transacoes_creditos enable row level security;

drop policy if exists "transacoes_creditos_select_own" on public.transacoes_creditos;
create policy "transacoes_creditos_select_own" on public.transacoes_creditos
  for select using (auth.uid() = user_id);

drop policy if exists "transacoes_creditos_select_admin" on public.transacoes_creditos;
create policy "transacoes_creditos_select_admin" on public.transacoes_creditos
  for select using (public.is_admin(auth.uid()));

-- ========== promoção/rebaixamento manual (admin) ==========
create or replace function public.promote_user_to_pro(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creditos_mensais int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas administradores podem promover usuários.';
  end if;

  update public.profiles
  set role = 'pro',
      data_inicio_pro = now(),
      data_proxima_renovacao = now() + interval '30 days',
      creditos_ia = creditos_mensais
  where id = target_user
  returning creditos_mensais into v_creditos_mensais;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  insert into public.transacoes_creditos (user_id, tipo, quantidade, descricao)
  values (target_user, 'ajuste_admin', v_creditos_mensais, 'Promoção para Pro — carga inicial de créditos');
end;
$$;

create or replace function public.demote_user_to_free(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creditos_antigos int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas administradores podem rebaixar usuários.';
  end if;

  select creditos_ia into v_creditos_antigos from public.profiles where id = target_user;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  update public.profiles
  set role = 'free',
      creditos_ia = 0,
      data_inicio_pro = null,
      data_proxima_renovacao = null
  where id = target_user;

  if v_creditos_antigos <> 0 then
    insert into public.transacoes_creditos (user_id, tipo, quantidade, descricao)
    values (target_user, 'ajuste_admin', -v_creditos_antigos, 'Rebaixamento para Free — créditos zerados');
  end if;
end;
$$;

-- ========== cobrança via Stripe (Checkout + Portal + webhook) ==========
alter table public.profiles
  add column if not exists stripe_customer_id text;

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;

create or replace function public.stripe_activate_pro(target_user uuid, p_stripe_customer_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creditos_mensais int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'stripe_activate_pro só pode ser chamada pelo webhook do Stripe.';
  end if;

  update public.profiles
  set role = 'pro',
      stripe_customer_id = p_stripe_customer_id,
      data_inicio_pro = coalesce(data_inicio_pro, now()),
      data_proxima_renovacao = now() + interval '30 days',
      creditos_ia = creditos_mensais
  where id = target_user
  returning creditos_mensais into v_creditos_mensais;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  insert into public.transacoes_creditos (user_id, tipo, quantidade, descricao)
  values (target_user, 'ajuste_admin', v_creditos_mensais, 'Assinatura Stripe ativada — carga inicial de créditos');
end;
$$;

create or replace function public.stripe_deactivate_pro(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creditos_antigos int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'stripe_deactivate_pro só pode ser chamada pelo webhook do Stripe.';
  end if;

  select creditos_ia into v_creditos_antigos from public.profiles where id = target_user;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  update public.profiles
  set role = 'free',
      creditos_ia = 0,
      data_inicio_pro = null,
      data_proxima_renovacao = null
  where id = target_user;

  if v_creditos_antigos <> 0 then
    insert into public.transacoes_creditos (user_id, tipo, quantidade, descricao)
    values (target_user, 'ajuste_admin', -v_creditos_antigos, 'Assinatura Stripe cancelada — créditos zerados');
  end if;
end;
$$;

alter table public.profiles
  add column if not exists licenca_avulsa_expira_em timestamptz;

create or replace function public.stripe_activate_pro_avulso(target_user uuid, dias int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creditos_mensais int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'stripe_activate_pro_avulso só pode ser chamada pelo webhook do Stripe.';
  end if;

  update public.profiles
  set role = 'pro',
      data_inicio_pro = coalesce(data_inicio_pro, now()),
      data_proxima_renovacao = now() + interval '30 days',
      creditos_ia = creditos_mensais,
      licenca_avulsa_expira_em = now() + (dias || ' days')::interval
  where id = target_user
  returning creditos_mensais into v_creditos_mensais;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  insert into public.transacoes_creditos (user_id, tipo, quantidade, descricao)
  values (target_user, 'ajuste_admin', v_creditos_mensais, 'Licença avulsa (Pix) ativada — carga inicial de créditos');
end;
$$;

create or replace function public.expirar_licencas_avulsas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles
  set role = 'free',
      creditos_ia = 0,
      data_inicio_pro = null,
      data_proxima_renovacao = null,
      licenca_avulsa_expira_em = null
  where role = 'pro'
    and licenca_avulsa_expira_em is not null
    and licenca_avulsa_expira_em < now();
end;
$$;

create or replace function public.renovar_creditos_pro()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_profile_protection', 'true', true);
  with renovados as (
    update public.profiles
    set creditos_ia = creditos_mensais,
        data_proxima_renovacao = data_proxima_renovacao + interval '30 days'
    where role = 'pro' and data_proxima_renovacao <= now()
    returning id, creditos_mensais
  )
  insert into public.transacoes_creditos (user_id, tipo, quantidade, descricao)
  select id, 'renovacao_mensal', creditos_mensais, 'Renovação mensal de créditos Pro'
  from renovados;
end;
$$;

create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'renovar-creditos-pro-diario';
exception when others then null;
end $$;

select cron.schedule(
  'renovar-creditos-pro-diario',
  '0 3 * * *',
  $$select public.renovar_creditos_pro();$$
);

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'expirar-licencas-avulsas-diario';
exception when others then null;
end $$;

select cron.schedule(
  'expirar-licencas-avulsas-diario',
  '0 3 * * *',
  $$select public.expirar_licencas_avulsas();$$
);

-- ========== tela de Administração ==========
create or replace function public.admin_list_users()
returns table (
  id uuid,
  nome text,
  email text,
  role public.user_role_enum,
  data_inicio_pro timestamptz,
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
    select p.id, p.nome, u.email::text, p.role, p.data_inicio_pro, p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

create or replace function public.admin_adjust_creditos(target_user uuid, delta int, motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas administradores podem ajustar créditos.';
  end if;
  if delta = 0 then
    raise exception 'O ajuste não pode ser zero.';
  end if;

  update public.profiles
  set creditos_ia = greatest(0, creditos_ia + delta)
  where id = target_user;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  insert into public.transacoes_creditos (user_id, tipo, quantidade, descricao)
  values (target_user, 'ajuste_admin', delta, coalesce(nullif(trim(motivo), ''), 'Ajuste manual pelo admin'));
end;
$$;

create or replace function public.admin_set_creditos_mensais(target_user uuid, novo_valor int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Apenas administradores podem alterar o limite mensal de créditos.';
  end if;
  if novo_valor < 0 then
    raise exception 'O limite mensal não pode ser negativo.';
  end if;

  update public.profiles set creditos_mensais = novo_valor where id = target_user;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
end;
$$;

-- ========== consumo de créditos nas Edge Functions ==========
create or replace function public.consumir_credito_ia(descricao text default 'Uso de IA')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role_enum;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();

  if not found then
    return false;
  end if;
  if v_role = 'admin' or v_role = 'pro' then
    return true;
  end if;

  return false;
end;
$$;

-- ========== regras de negócio Free vs Pro (limites diários) ==========
alter table public.profiles
  add column if not exists estimativas_ia_free_hoje int not null default 0,
  add column if not exists estimativas_ia_free_data date;

create or replace function public.consumir_estimativa_ia_free()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role_enum;
  v_hoje int;
  v_data date;
begin
  perform set_config('app.bypass_profile_protection', 'true', true);

  select role, estimativas_ia_free_hoje, estimativas_ia_free_data
  into v_role, v_hoje, v_data
  from public.profiles
  where id = auth.uid()
  for update;

  if not found or v_role <> 'free' then
    return false;
  end if;

  if v_data is distinct from current_date then
    v_hoje := 0;
  end if;

  if v_hoje >= 3 then
    return false;
  end if;

  update public.profiles
  set estimativas_ia_free_hoje = v_hoje + 1,
      estimativas_ia_free_data = current_date
  where id = auth.uid();

  return true;
end;
$$;

alter table public.refeicoes
  add column if not exists edicoes int not null default 0;

create or replace function public.protect_refeicoes_free_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role_enum;
  v_count int;
begin
  select role into v_role from public.profiles where id = new.user_id;
  if v_role <> 'free' then
    return new;
  end if;

  select count(*) into v_count from public.refeicoes where user_id = new.user_id and data = new.data;
  if v_count >= 5 then
    raise exception 'Plano Free permite até 5 alimentos registrados por dia. Assine o Pro para registros ilimitados.';
  end if;
  return new;
end;
$$;

drop trigger if exists refeicoes_free_insert_limit on public.refeicoes;
create trigger refeicoes_free_insert_limit
  before insert on public.refeicoes
  for each row execute function public.protect_refeicoes_free_limits();

create or replace function public.protect_refeicoes_free_edit_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role_enum;
begin
  select role into v_role from public.profiles where id = new.user_id;
  if v_role = 'free' and old.edicoes >= 1 then
    raise exception 'Plano Free permite 1 edição por alimento registrado. Assine o Pro para edições ilimitadas.';
  end if;
  new.edicoes := old.edicoes + 1;
  return new;
end;
$$;

drop trigger if exists refeicoes_free_edit_limit on public.refeicoes;
create trigger refeicoes_free_edit_limit
  before update on public.refeicoes
  for each row execute function public.protect_refeicoes_free_edit_limit();

create or replace function public.is_free(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'free'
  );
$$;

drop policy if exists "refeicoes_select_own" on public.refeicoes;
create policy "refeicoes_select_own" on public.refeicoes
  for select using (
    auth.uid() = user_id
    and (not public.is_free(auth.uid()) or data >= (current_date - interval '7 days'))
  );

drop policy if exists "treinos_select_own" on public.treinos;
create policy "treinos_select_own" on public.treinos
  for select using (
    auth.uid() = user_id
    and (not public.is_free(auth.uid()) or data >= (current_date - interval '7 days'))
  );

drop policy if exists "registros_peso_select_own" on public.registros_peso;
create policy "registros_peso_select_own" on public.registros_peso
  for select using (
    auth.uid() = user_id
    and (not public.is_free(auth.uid()) or data >= (current_date - interval '7 days'))
  );

-- ========== foto de refeição com IA (Pro) ==========
alter table public.refeicoes
  add column if not exists foto_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "meal_photos_insert_own" on storage.objects;
create policy "meal_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "meal_photos_select_own" on storage.objects;
create policy "meal_photos_select_own" on storage.objects
  for select using (
    bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "meal_photos_delete_own" on storage.objects;
create policy "meal_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========== mais tipos de treino ==========
alter type tipo_atividade_enum add value if not exists 'caminhada';
alter type tipo_atividade_enum add value if not exists 'yoga';
alter type tipo_atividade_enum add value if not exists 'pilates';
alter type tipo_atividade_enum add value if not exists 'crossfit';
alter type tipo_atividade_enum add value if not exists 'danca';
alter type tipo_atividade_enum add value if not exists 'hiit';

-- ========== foto de perfil ==========
alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========== pagamentos via Pix (Mercado Pago) ==========
-- ATENÇÃO: esta tabela foi criada em produção com uma estrutura diferente
-- da que estava documentada em schema.sql (que nunca chegou a ser rodado
-- de fato). A definição abaixo é a que reflete o banco real, extraída por
-- introspecção direta (pg_catalog) em 2026-09-25:
--   - user_id NÃO tem "on delete cascade" (diferente das outras tabelas)
--   - external_reference é NOT NULL + UNIQUE (não apenas um índice solto)
--   - mp_order_id é UNIQUE via constraint (não um índice nomeado à parte)
--   - não existe um índice extra em (user_id)
--   - só existe UMA policy de leitura (o usuário vê o próprio pedido);
--     nunca existiu uma policy de admin para esta tabela em produção.
-- Ficou assim porque as duas últimas colunas foram adicionadas via SQL
-- direto no projeto, sem passar por uma migration. Se algum dia quiser
-- alinhar (ex: adicionar on delete cascade, ou dar visibilidade de admin),
-- isso deve ser uma migration nova e deliberada — não algo para "corrigir"
-- silenciosamente aqui.
create table if not exists public.pix_orders (
  id uuid primary key default gen_random_uuid(),
  external_reference text not null unique,
  mp_order_id text not null unique,
  user_id uuid not null references auth.users(id),
  plan_code text not null,
  amount numeric(10,2) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  payer_email text not null,
  qr_code text,
  qr_code_base64 text
);

alter table public.pix_orders enable row level security;

drop policy if exists "Usuários veem seus próprios pedidos Pix" on public.pix_orders;
create policy "Usuários veem seus próprios pedidos Pix" on public.pix_orders
  for select using (auth.uid() = user_id);

-- ========== rede de segurança: RLS automático em toda tabela nova ==========
-- Existe em produção desde antes deste arquivo (não fazia parte do
-- schema.sql original). Garante que qualquer "create table" futuro em
-- public, mesmo que alguém esqueça o "enable row level security", já
-- nasça protegido por RLS (sem policy nenhuma = sem acesso via API, o que
-- é o padrão seguro — as policies têm que ser adicionadas depois,
-- explicitamente).
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

do $$ begin
  create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
exception when duplicate_object then null; end $$;

-- ========== fora do escopo desta migration (documentado, não reproduzido) ==========
-- Produção também tem uma tabela estrangeira `public.ciclodepagamento`
-- (relkind 'f', via a extensão `wrappers` + foreign server "Nutriibase_server"),
-- usada para consultar dados do Stripe direto por SQL. Não é reproduzida
-- aqui de propósito: exigiria configurar de novo um foreign server com
-- credencial do Stripe (via Vault) em cada ambiente novo, e não guarda
-- nenhum dado nosso (é só um proxy de leitura pra API do Stripe) — não é
-- código de aplicação nem precisa de backup. Se algum branch/ambiente novo
-- precisar dela, configure manualmente seguindo a doc do Supabase Wrappers
-- para Stripe.
