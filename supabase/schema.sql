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

-- ========== papéis de acesso e créditos de IA — colunas + is_admin() ==========
-- Precisa vir aqui, logo após as policies "own" de profiles: as policies
-- de admin abaixo (e o trigger de proteção de colunas, mais abaixo) usam
-- is_admin(), e CREATE POLICY valida a expressão using/check na hora —
-- diferente de uma função plpgsql, ela não aceita referência a uma
-- função que ainda não existe no momento em que a policy é criada. Como
-- este arquivo é pensado para ser rodado inteiro do zero (comentário no
-- topo do arquivo), a ordem aqui dentro importa de verdade.

do $$ begin
  create type public.user_role_enum as enum ('admin', 'pro', 'free');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists role public.user_role_enum not null default 'free',
  add column if not exists creditos_ia integer not null default 0,
  add column if not exists creditos_mensais integer not null default 50,
  add column if not exists data_inicio_pro timestamptz,
  add column if not exists data_proxima_renovacao timestamptz;

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

-- Admin enxerga e edita qualquer perfil (Etapa 3).
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

-- RLS é por LINHA, não por coluna — a policy "profiles_update_own" acima
-- deixa o próprio usuário atualizar a linha dele inteira, o que incluiria
-- role/créditos se nada mais impedisse. Este trigger fecha essa brecha:
-- só passa a alteração dessas 5 colunas se quem está atualizando for
-- admin (is_admin), for o service role (Edge Function de consumo de
-- créditos, Etapa 6) ou tiver marcado a flag de sessão
-- app.bypass_profile_protection (usada por renovar_creditos_pro(), que
-- roda via pg_cron sem nenhum auth.uid() — não tem como ser "admin").
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
  then
    raise exception 'Não é permitido alterar role ou créditos diretamente.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_columns on public.profiles;
create trigger profiles_protect_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- Override manual de proteína/gordura (em gramas) na aba Metas — quando
-- preenchido, o carboidrato da meta passa a ser o restante das calorias
-- (kcal - proteína*4 - gordura*9)/4, calculado no frontend. NULL em
-- qualquer um dos dois significa "usar o cálculo automático" para
-- aquele macro especificamente. Coluna comum, editável pelo próprio
-- usuário (não faz parte da proteção de colunas privilegiadas da
-- Etapa 3 — aquilo é só sobre role/créditos).
alter table public.profiles
  add column if not exists override_proteina_g int,
  add column if not exists override_gordura_g int;

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
-- Sem isso, um usuário que entra pelo Google nunca passa pelo ProfileForm
-- salvando a linha em profiles — o trigger garante que a linha sempre existe,
-- com nome pré-preenchido a partir do Google quando disponível, e o resto
-- com os defaults da tabela (nivel_atividade/objetivo/ritmo/role/créditos —
-- role/créditos, definidos mais acima, também têm default na tabela,
-- então todo INSERT feito por este trigger já sai com os valores certos
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

-- ========== papéis de acesso e créditos de IA — transações de crédito ==========
-- As colunas role/creditos_* em profiles e a função is_admin() já foram
-- criadas mais acima (logo após as policies "own" de profiles). Aqui
-- entra só a tabela de auditoria de créditos.

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

-- Só leitura por policy — o próprio usuário vê seu histórico, admin vê o
-- de todo mundo. Não existe insert/update/delete por policy de propósito:
-- toda escrita nessa tabela passa pelas funções security definer
-- (promote_user_to_pro, demote_user_to_free, renovar_creditos_pro, e a
-- Edge Function de consumo de créditos na Etapa 6), que ignoram RLS por
-- rodarem como o dono do projeto — assim a tabela de auditoria nunca
-- pode ser adulterada diretamente por um usuário comum nem por um admin
-- direto no cliente, só pelo caminho controlado do backend.
drop policy if exists "transacoes_creditos_select_own" on public.transacoes_creditos;
create policy "transacoes_creditos_select_own" on public.transacoes_creditos
  for select using (auth.uid() = user_id);

drop policy if exists "transacoes_creditos_select_admin" on public.transacoes_creditos;
create policy "transacoes_creditos_select_admin" on public.transacoes_creditos
  for select using (public.is_admin(auth.uid()));

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
--
-- (Atualizada na Etapa 3): pg_cron não carrega nenhum JWT — auth.uid()
-- fica null aqui dentro, então is_admin(auth.uid()) do trigger de
-- proteção de colunas nunca passaria. set_config com o 3º argumento
-- `true` deixa a flag valendo só dentro desta transação, sem vazar pra
-- fora nem exigir um "unset" depois.
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

-- ========== papéis de acesso e créditos de IA — Etapa 5 (tela de Administração) ==========
-- Três funções security definer, todas checando is_admin(auth.uid()) por
-- conta própria (defesa em profundidade, igual às da Etapa 2) — a tela de
-- Administração no frontend só chama RPC, nunca faz update direto na
-- tabela profiles, mesmo sendo tecnicamente permitido pra admin pela RLS
-- + trigger da Etapa 3. Isso mantém toda escrita privilegiada centralizada
-- e auditável num único lugar.

-- profiles não guarda e-mail (fica em auth.users, schema que o cliente
-- não acessa via PostgREST) — esta função faz o join e devolve pro
-- frontend só quando quem chama é admin.
create or replace function public.admin_list_users()
returns table (
  id uuid,
  nome text,
  email text,
  role public.user_role_enum,
  creditos_ia int,
  creditos_mensais int,
  data_inicio_pro timestamptz,
  data_proxima_renovacao timestamptz,
  created_at timestamptz
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
           p.data_inicio_pro, p.data_proxima_renovacao, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

-- Ajuste pontual (positivo ou negativo) no saldo atual de créditos —
-- usado pelo admin pra dar créditos extras ou corrigir algo manualmente.
-- Sempre loga em transacoes_creditos (tipo=ajuste_admin) pra manter
-- rastro de auditoria de toda mudança de saldo.
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

-- Muda o limite mensal (o valor que creditos_ia recebe a cada renovação
-- via renovar_creditos_pro()) — não mexe no saldo atual, só no teto
-- futuro, por isso não gera lançamento em transacoes_creditos.
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

-- ========== papéis de acesso e créditos de IA — Etapa 6 (consumo nas Edge Functions) ==========
-- Chamada pelas Edge Functions (describe-meal, chat-assistant) logo após
-- uma resposta bem-sucedida da IA, sempre em nome de quem está logado
-- (auth.uid() — nunca recebe um user_id por parâmetro, pra não dar
-- brecha de um usuário decrementar crédito de outro). Admin não consome
-- (retorna true sem mexer em nada); Free não deveria nem chegar aqui
-- (a Edge Function já bloqueia antes de chamar a IA), mas por segurança
-- também retorna false aqui. `for update` trava a linha durante a
-- função pra duas chamadas simultâneas do mesmo usuário não zerarem os
-- créditos em dobro (não deixar creditos_ia ficar negativo).
create or replace function public.consumir_credito_ia(descricao text default 'Uso de IA')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role_enum;
  v_creditos int;
begin
  perform set_config('app.bypass_profile_protection', 'true', true);

  select role, creditos_ia into v_role, v_creditos
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    return false;
  end if;
  if v_role = 'admin' then
    return true;
  end if;
  if v_role <> 'pro' or v_creditos <= 0 then
    return false;
  end if;

  update public.profiles set creditos_ia = creditos_ia - 1 where id = auth.uid();

  insert into public.transacoes_creditos (user_id, tipo, quantidade, descricao)
  values (auth.uid(), 'consumo', -1, coalesce(nullif(trim(descricao), ''), 'Uso de IA'));

  return true;
end;
$$;
