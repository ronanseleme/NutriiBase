-- Concede os privilégios básicos de tabela (SELECT/INSERT/UPDATE/DELETE)
-- para anon/authenticated/service_role em todas as tabelas de public.
--
-- Faltava isso na baseline de migrations: num projeto Supabase criado
-- normalmente pelo dashboard, a plataforma aplica esses grants
-- automaticamente por trás dos panos sempre que uma tabela é criada.
-- Como reconstruímos o schema via migrations "cruas" (DDL puro extraído
-- do banco), esses grants implícitos nunca foram capturados — e um
-- branch novo, criado só a partir das migrations, nasce sem eles.
-- RLS continua sendo a camada de segurança real (isso aqui só destrava
-- o acesso à tabela; RLS decide quais linhas cada um vê/edita).
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Garante que tabelas/sequências/funções futuras (criadas por migrations
-- seguintes) já nasçam com os mesmos grants, sem precisar lembrar de
-- repetir isso toda vez.
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
