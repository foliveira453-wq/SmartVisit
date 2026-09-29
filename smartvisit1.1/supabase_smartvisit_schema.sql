-- ==============================================================================
-- SMARTVISIT - SCHEMA COMPLETO E DEFINITIVO PARA SUPABASE (POSTGRESQL + RLS)
-- Copie e cole este script diretamente no 'SQL Editor' do painel do Supabase.
-- ==============================================================================

-- 1. Habilitar extensões úteis
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ==============================================================================
-- 2. LIMPEZA PREVENTIVA DE TABELAS ANTIGAS
-- Remove versões anteriores onde a coluna 'id' possa ter sido criada como UUID
-- ==============================================================================
drop table if exists public.orcamentos cascade;
drop table if exists public.feed_posts cascade;
drop table if exists public.usuarios cascade;
drop table if exists public.clientes cascade;
drop table if exists public.produtos cascade;
drop table if exists public.filiais cascade;

-- ==============================================================================
-- 3. TABELA: FILIAIS (WORKSPACES COM ID EM FORMATO TEXTO)
-- ==============================================================================
create table public.filiais (
  id text primary key, -- ex: 'ws-pi100', 'ws-ce100', etc.
  filial_id text,
  nome text not null,
  cnpj text,
  gerente_id text,
  gerente_nome text,
  primary_color text default '#1e40af',
  logo_url text,
  razao_social text,
  endereco text,
  bairro text,
  municipio text,
  uf text,
  cep text,
  telefone text,
  fax text,
  inscricao_estadual text,
  whatsapp_default text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- 4. TABELA: USUÁRIOS (ROLES, FILIAL E VÍNCULO - ID EM FORMATO TEXTO)
-- ==============================================================================
create table public.usuarios (
  id text primary key, -- ex: 'usr-diretor', 'usr-gestor-pi', etc.
  login text unique not null,
  senha text not null default '123',
  nome text not null,
  setor text,
  role text not null check (role in ('diretor', 'gestor', 'gerente', 'vendedor')),
  workspace_id text not null references public.filiais(id) on delete cascade,
  filial_id text,
  avatar_url text,
  ativo boolean default true,
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Índices para busca ágil
create index idx_usuarios_workspace on public.usuarios(workspace_id);
create index idx_usuarios_role on public.usuarios(role);
create index idx_usuarios_login on public.usuarios(login);

-- ==============================================================================
-- 5. TABELA: PUBLICAÇÕES DO FEED (COMUNICADOS, METAS E ARQUIVOS)
-- ==============================================================================
create table public.feed_posts (
  id text primary key default gen_random_uuid()::text,
  workspace_id text not null references public.filiais(id) on delete cascade,
  filial_id text,
  autor_id text not null,
  autor_nome text not null,
  autor_role text not null,
  autor_avatar_url text,
  target_workspace_ids text[] default array['ALL']::text[],
  data timestamp with time zone default timezone('utc'::text, now()) not null,
  legenda text not null,
  imagens text[] default '{}'::text[],
  arquivos jsonb default '[]'::jsonb,
  fixado boolean default false,
  reacoes jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_feed_posts_workspace on public.feed_posts(workspace_id);
create index idx_feed_posts_data on public.feed_posts(data desc);

-- ==============================================================================
-- 6. TABELA: ORÇAMENTOS (PROPOSTAS COMERCIAIS & HISTÓRICO)
-- ==============================================================================
create table public.orcamentos (
  id text primary key default gen_random_uuid()::text,
  numero_sequencial bigint not null,
  codigo_proposta text not null,
  workspace_id text not null references public.filiais(id) on delete cascade,
  filial_id text,
  vendedor_id text not null,
  vendedor_nome text not null,
  data_emissao timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Dados do Cliente no momento da emissão
  cliente_codigo text not null,
  cliente_razao_social text not null,
  cliente_cnpj text,
  cliente_endereco text,
  cliente_bairro text,
  cliente_cidade text,
  cliente_uf text,
  cliente_cep text,
  cliente_telefone text,
  cliente_fax text,
  
  -- Itens e Totais
  itens jsonb not null default '[]'::jsonb,
  subtotal_mercadorias numeric(12,2) not null default 0,
  outras_despesas numeric(12,2) default 0,
  frete numeric(12,2) default 0,
  valor_total numeric(12,2) not null default 0,
  
  -- Status e Condições
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aprovado', 'cancelado')),
  prazo_pagamento text,
  historico jsonb default '[]'::jsonb,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_orcamentos_workspace on public.orcamentos(workspace_id);
create index idx_orcamentos_vendedor on public.orcamentos(vendedor_id);
create index idx_orcamentos_data on public.orcamentos(data_emissao desc);
create index idx_orcamentos_codigo on public.orcamentos(codigo_proposta);

-- ==============================================================================
-- 7. TABELAS DE APOIO: CLIENTES E PRODUTOS (CATÁLOGO MULTIEMPRESA)
-- ==============================================================================
create table public.clientes (
  id text primary key default gen_random_uuid()::text,
  workspace_id text not null references public.filiais(id) on delete cascade,
  filial_id text,
  codigo text not null,
  razao_social text not null,
  cnpj text,
  cpf_cnpj text,
  endereco text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  telefone text,
  fax text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_clientes_workspace on public.clientes(workspace_id);
create index idx_clientes_codigo on public.clientes(codigo);

create table public.produtos (
  id text primary key default gen_random_uuid()::text,
  workspace_id text not null references public.filiais(id) on delete cascade,
  filial_id text,
  codigo text not null,
  descricao text not null,
  embalagem text not null default 'UN',
  preco_base numeric(12,2) not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_produtos_workspace on public.produtos(workspace_id);
create index idx_produtos_codigo on public.produtos(codigo);

-- ==============================================================================
-- 8. ATIVAÇÃO DE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
alter table public.filiais enable row level security;
alter table public.usuarios enable row level security;
alter table public.feed_posts enable row level security;
alter table public.orcamentos enable row level security;
alter table public.clientes enable row level security;
alter table public.produtos enable row level security;

-- ==============================================================================
-- 9. POLÍTICAS DE SEGURANÇA (RLS POLICIES)
-- ==============================================================================
create policy "Permitir leitura de filiais"
  on public.filiais for select to anon, authenticated using (true);

create policy "Permitir gestão de filiais"
  on public.filiais for all to anon, authenticated using (true) with check (true);

create policy "Permitir leitura de usuários"
  on public.usuarios for select to anon, authenticated using (true);

create policy "Permitir gestão de usuários"
  on public.usuarios for all to anon, authenticated using (true) with check (true);

create policy "Permitir leitura do feed"
  on public.feed_posts for select to anon, authenticated using (true);

create policy "Permitir criação e edição de posts no feed"
  on public.feed_posts for all to anon, authenticated using (true) with check (true);

create policy "Permitir leitura de orçamentos"
  on public.orcamentos for select to anon, authenticated using (true);

create policy "Permitir inserção e atualização de orçamentos"
  on public.orcamentos for all to anon, authenticated using (true) with check (true);

create policy "Permitir leitura e escrita de clientes"
  on public.clientes for all to anon, authenticated using (true) with check (true);

create policy "Permitir leitura e escrita de produtos"
  on public.produtos for all to anon, authenticated using (true) with check (true);

-- ==============================================================================
-- 10. CARGA DE DADOS INICIAIS (SEEDS PADRÃO DO SMARTVISIT)
-- ==============================================================================
insert into public.filiais (id, filial_id, nome, cnpj, gerente_id, gerente_nome, primary_color, razao_social, endereco, bairro, municipio, uf, cep, telefone, inscricao_estadual)
values
  ('ws-pi100', 'ws-pi100', 'NOVUM DISTRIBUIDORA PI', '12.345.678/0001-90', 'usr-gestor-pi', 'Carlos Eduardo Silveira', '#1e40af', 'NOVUM DISTRIBUIDORA DE PRODUTOS TÉCNICOS LTDA', 'Av. Miguel Rosa, 4500', 'Nossa Senhora das Graças', 'Teresina', 'PI', '64001-020', '(86) 3221-4000', '19.456.789-0'),
  ('ws-ce100', 'ws-ce100', 'NOVUM DISTRIBUIDORA CE', '08.123.456/0001-77', 'usr-gestor-ce', 'Ana Paula Holanda', '#ea580c', 'NOVUM DISTRIBUIDORA CE LTDA', 'Av. Santos Dumont, 3000 - Aldeota', 'Aldeota', 'Fortaleza', 'CE', '60150-161', '(85) 3244-5000', '06.987.654-3'),
  ('ws-agro200', 'ws-agro200', 'AgroSul Equipamentos & Peças RS', '98.765.432/0001-11', 'usr-gestor-rs', 'Fernanda Lima', '#15803d', 'AgroSul Equipamentos Agrícolas & Peças Ltda', 'Rodovia BR-116, Km 210, Galpão 04', 'Distrito Industrial', 'Caxias do Sul', 'RS', '95000-000', '(54) 3210-9876', '029/0123456'),
  ('ws-tech100', 'ws-tech100', 'TechSolutions Distribuidora SP', '45.678.901/0001-22', 'usr-gestor-sp', 'Renato Albuquerque', '#0f766e', 'TechSolutions Distribuidora SP S.A.', 'Av. das Nações Unidas, 12901 - Bloco C', 'Brooklin Novo', 'São Paulo', 'SP', '04578-000', '(11) 3456-7890', '112.345.678.910')
on conflict (id) do nothing;

insert into public.usuarios (id, login, senha, nome, setor, role, workspace_id, filial_id)
values
  ('usr-diretor', 'diretor@smartvisit.com', '123', 'Roberto Mendes', 'Diretoria Executiva Global', 'diretor', 'ws-pi100', 'ws-pi100'),
  ('usr-gestor-pi', 'carlos.gestor@novumpi.com', '123', 'Carlos Eduardo Silveira', 'Gerência Comercial PI', 'gestor', 'ws-pi100', 'ws-pi100'),
  ('usr-vendedor-pi1', 'marcos.vendedor@novumpi.com', '123', 'Marcos Vinicius Santos', 'Vendas Teresina / Litoral', 'vendedor', 'ws-pi100', 'ws-pi100'),
  ('usr-gestor-ce', 'ana.gestora@novumce.com', '123', 'Ana Paula Holanda', 'Gerência Comercial CE', 'gestor', 'ws-ce100', 'ws-ce100'),
  ('usr-vendedor-ce1', 'lucas.vendedor@novumce.com', '123', 'Lucas Ferreira', 'Vendas Fortaleza & Região', 'vendedor', 'ws-ce100', 'ws-ce100'),
  ('usr-gestor-rs', 'fernanda.gestora@agrosulrs.com', '123', 'Fernanda Lima', 'Gerência Comercial RS', 'gestor', 'ws-agro200', 'ws-agro200'),
  ('usr-vendedor-rs1', 'rodrigo.vendedor@agrosulrs.com', '123', 'Rodrigo Klein', 'Vendas Serra Gaúcha & Região', 'vendedor', 'ws-agro200', 'ws-agro200'),
  ('usr-gestor-sp', 'renato.gestor@techsp.com', '123', 'Renato Albuquerque', 'Gerência Geral SP', 'gestor', 'ws-tech100', 'ws-tech100'),
  ('usr-vendedor-sp1', 'juliana.vendedora@techsp.com', '123', 'Juliana Rocha', 'Vendas Corporativas SP Capital', 'vendedor', 'ws-tech100', 'ws-tech100')
on conflict (id) do nothing;
