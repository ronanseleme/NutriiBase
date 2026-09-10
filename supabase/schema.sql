-- NutriiBase — schema + Row Level Security
-- Rode este arquivo inteiro no SQL Editor do Supabase (Database > SQL Editor > New query).
--
-- Notas sobre pequenos ajustes em relação à especificação original (documentados para revisão):
-- 1) profiles: adicionadas as colunas opcionais `percentual_gordura_atual`,
--    `percentual_gordura_meta` e `meta_treinos_semanais` — o app já tem essas
--    funcionalidades (Katch-McArdle, meta de % de gordura, meta de treinos/semana)
--    e elas ficariam sem onde persistir se o schema seguisse só os campos originais.
-- 2) registros_peso: adicionada a coluna opcional `percentual_gordura` (o app já
--    registra "percentual de gordura do dia" junto com o peso do dia) e uma
--    constraint unique(user_id, data) para permitir upsert (1 registro por dia).
-- 3) metas_mensais: unique(user_id, mes_ano) pelo mesmo motivo (1 registro por mês).
-- 4) profiles.objetivo usa o valor 'ganho_massa' (conforme pedido); o app internamente
--    usa a chave "ganho" — o frontend faz o de/para na hora de ler/gravar.
-- 5) profiles.nivel_atividade aceita 'sedentario' e 'atleta' (conforme pedido), mas o
--    app hoje só oferece 3 opções na interface (leve/moderado/intenso) — os outros dois
--    valores do enum ficam disponíveis para uso futuro.
-- 6) treinos: adicionada a coluna opcional `pace_min_km` — o modo "distância" do
--    registro de corrida guarda o pace (min/km) usado para estimar o gasto calórico,
--    e precisa ser recuperado ao carregar o treino de novo (para exibir/editar).
-- 7) registros_peso.peso_kg passou a ser opcional (sem "not null") — o app permite
--    salvar só o percentual de gordura do dia sem peso, e vice-versa (upsert por dia).

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

drop policy if exists "refeicoes_select_own" on public.refeicoes;
create policy "refeicoes_select_own" on public.refeicoes
  for select using (auth.uid() = user_id);

drop policy if exists "refeicoes_insert_own" on public.refeicoes;
create policy "refeicoes_insert_own" on public.refeicoes
  for insert with check (auth.uid() = user_id);

drop policy if exists "refeicoes_update_own" on public.refeicoes;
create policy "refeicoes_update_own" on public.refeicoes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "refeicoes_delete_own" on public.refeicoes;
create policy "refeicoes_delete_own" on public.refeicoes
  for delete using (auth.uid() = user_id);

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

drop policy if exists "treinos_select_own" on public.treinos;
create policy "treinos_select_own" on public.treinos
  for select using (auth.uid() = user_id);

drop policy if exists "treinos_insert_own" on public.treinos;
create policy "treinos_insert_own" on public.treinos
  for insert with check (auth.uid() = user_id);

drop policy if exists "treinos_update_own" on public.treinos;
create policy "treinos_update_own" on public.treinos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "treinos_delete_own" on public.treinos;
create policy "treinos_delete_own" on public.treinos
  for delete using (auth.uid() = user_id);

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

drop policy if exists "registros_peso_select_own" on public.registros_peso;
create policy "registros_peso_select_own" on public.registros_peso
  for select using (auth.uid() = user_id);

drop policy if exists "registros_peso_insert_own" on public.registros_peso;
create policy "registros_peso_insert_own" on public.registros_peso
  for insert with check (auth.uid() = user_id);

drop policy if exists "registros_peso_update_own" on public.registros_peso;
create policy "registros_peso_update_own" on public.registros_peso
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "registros_peso_delete_own" on public.registros_peso;
create policy "registros_peso_delete_own" on public.registros_peso
  for delete using (auth.uid() = user_id);

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

-- ========== auto-criação de profile em todo novo usuário (e-mail ou OAuth) ==========
-- Sem isso, um usuário que entra pelo Google nunca passa pelo ProfileForm
-- salvando a linha em profiles — o trigger garante que a linha sempre existe,
-- com nome pré-preenchido a partir do Google quando disponível, e o resto
-- com os defaults da tabela (nivel_atividade/objetivo/ritmo/role/créditos —
-- role/créditos foram adicionados depois, na seção "papéis de acesso e
-- créditos de IA" mais abaixo, mas por serem colunas com default na
-- tabela, todo INSERT feito por este trigger já sai com os valores certos
-- sem precisar tocar aqui).
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

-- ========== papéis de acesso e créditos de IA — Etapa 1 (schema) ==========
-- Etapas seguintes (fora deste arquivo por enquanto, chegam em commits
-- separados): 2) lógica de virar Pro / renovar_creditos_pro() / pg_cron,
-- 3) policies de RLS admin + proteção contra o usuário alterar essas
-- colunas na própria linha, 4-7) frontend, tela de Admin, consumo de
-- créditos nas Edge Functions.

do $$ begin
  create type public.user_role_enum as enum ('admin', 'pro', 'free');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists role public.user_role_enum not null default 'free',
  add column if not exists creditos_ia integer not null default 0,
  add column if not exists creditos_mensais integer not null default 50,
  add column if not exists data_inicio_pro timestamptz,
  add column if not exists data_proxima_renovacao timestamptz;

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

-- RLS ligado desde já (fail-closed: sem nenhuma policy ainda, ninguém além
-- do service role consegue ler/gravar aqui). As policies de verdade
-- (usuário vê o próprio histórico, admin vê/grava tudo) entram na Etapa 3.
alter table public.transacoes_creditos enable row level security;

-- security definer + search_path fixo: roda com os privilégios de quem
-- criou a função (o dono do projeto), que por padrão ignora RLS — por
-- isso não entra em recursão ao consultar profiles (que também tem RLS)
-- de dentro de uma policy da própria tabela profiles.
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

-- ========== papéis de acesso e créditos de IA — Etapa 2 (promoção/renovação) ==========
-- promote_user_to_pro / demote_user_to_free são as únicas formas suportadas
-- de mudar o role de alguém (chamadas via RPC pela tela de Administração,
-- Etapa 5). Cada uma checa is_admin(auth.uid()) por conta própria — não
-- dependem só da policy de RLS (que ainda nem existe até a Etapa 3) —
-- então já podem ser chamadas com segurança assim que a Etapa 5 existir.

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

  -- creditos_mensais é mantido de propósito: se o usuário virar Pro de
  -- novo depois, volta com o mesmo limite configurado antes.
  if v_creditos_antigos <> 0 then
    insert into public.transacoes_creditos (user_id, tipo, quantidade, descricao)
    values (target_user, 'ajuste_admin', -v_creditos_antigos, 'Rebaixamento para Free — créditos zerados');
  end if;
end;
$$;

-- Roda diariamente (via pg_cron, agendado mais abaixo) e renova todo Pro
-- cujo ciclo de 30 dias já venceu. Se o cron ficar fora do ar por um
-- tempo, um usuário muito atrasado só avança um ciclo de 30 dias por
-- execução — mas como isso roda todo dia, ele se recupera sozinho em
-- poucos dias sem precisar de intervenção manual.
create or replace function public.renovar_creditos_pro()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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

-- Ativa a extensão pg_cron (em alguns projetos Supabase precisa ser
-- ligada manualmente antes em Database > Extensions, se este create
-- extension falhar por falta de permissão).
create extension if not exists pg_cron;

-- Idempotente: remove o agendamento antigo (se existir) antes de recriar,
-- pra este arquivo poder ser rodado de novo sem duplicar o job.
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
