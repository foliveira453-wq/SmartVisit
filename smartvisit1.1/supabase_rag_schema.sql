-- ==============================================================================
-- SCHEMA SUPABASE PGVECTOR PARA O ASSISTENTE RAG (NOTEBOOKLM) - SMARTVISIT
-- Execute este script no SQL Editor do seu projeto Supabase
-- ==============================================================================

-- 1. Habilita a extensão pgvector para suporte a vetores e buscas por similaridade
create extension if not exists vector;

-- 2. Tabela para armazenamento dos chunks de documentos e seus embeddings vetoriais
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id text not null,
  workspace_id text not null,
  document_name text not null,
  source_type text not null, -- 'pdf', 'texto', 'md', 'web', 'youtube', 'gdocs', 'gslides'
  source_url text,
  chunk_index int not null,
  content text not null,
  embedding vector(3072), -- Dimensão compatível com o modelo gemini-embedding-2 do Google Gemini
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Índices para performance: índice vetorial (HNSW ou IVFFlat) e filtro por workspace
create index if not exists idx_document_chunks_workspace_id on document_chunks (workspace_id);
create index if not exists idx_document_chunks_document_id on document_chunks (document_id);

-- Índice vetorial com distância de cosseno (opcional, recomendado para bases com muitos chunks)
create index if not exists idx_document_chunks_embedding 
  on document_chunks 
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4. Função RPC para busca de similaridade por cosseno com o "Prompt de Ferro"
create or replace function match_document_chunks (
  query_embedding vector(3072),
  match_count int default 6,
  filter_workspace_id text default null
) returns table (
  id uuid,
  document_id text,
  workspace_id text,
  document_name text,
  source_type text,
  source_url text,
  chunk_index int,
  content text,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    dc.id,
    dc.document_id,
    dc.workspace_id,
    dc.document_name,
    dc.source_type,
    dc.source_url,
    dc.chunk_index,
    dc.content,
    (1 - (dc.embedding <=> query_embedding))::float as similarity
  from document_chunks dc
  where (filter_workspace_id is null or dc.workspace_id = filter_workspace_id)
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;
