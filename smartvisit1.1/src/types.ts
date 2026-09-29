/**
 * SmartVisit - Core Data Types & Multi-tenant Schema
 */

export type UserRole = 'diretor' | 'gestor' | 'gerente' | 'vendedor';

export interface User {
  id: string;
  login: string;
  senha: string;
  nome: string;
  setor: string;
  role: UserRole;
  workspace_id: string;
  filialId?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  filialId?: string;
  nome: string;
  cnpj: string;
  gerente_id?: string;
  gerente_nome?: string;
  primary_color: string;
  logo_url?: string;
  created_at: string;
}

export interface EmpresaEmitente {
  workspace_id: string;
  filialId?: string;
  razao_social: string;
  cnpj: string;
  endereco: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  fax?: string;
  inscricao_estadual: string;
  logo_url?: string;
  whatsapp_default?: string;
}

export interface Cliente {
  id: string;
  workspace_id: string;
  filialId?: string;
  codigo: string;
  razao_social: string;
  cnpj?: string;
  cpf_cnpj?: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  fax?: string;
}

export interface Produto {
  id: string;
  workspace_id: string;
  filialId?: string;
  codigo: string;
  descricao: string;
  embalagem: string; // "E" (e.g., UN, CX, KG, PC, M)
  preco_base: number;
}

export interface FeedPost {
  id: string;
  workspace_id: string;
  filialId?: string;
  autor_id: string;
  autor_nome: string;
  autor_role: UserRole;
  autor_avatar_url?: string;
  target_workspace_ids?: string[]; // ['ALL'] or list of workspace IDs
  data: string;
  legenda: string;
  imagens: string[]; // URLs or base64
  arquivos: { nome: string; url: string; tamanho?: string }[];
  fixado?: boolean;
  reacoes?: { emoji: string; usuarios: { id: string; nome: string }[] }[];
}

export interface QuotationItem {
  id: string;
  item_num: number;
  produto_codigo: string;
  descricao: string;
  embalagem: string; // "E"
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
}

export interface QuotationHistoryEntry {
  id: string;
  timestamp: string;
  usuario_id: string;
  usuario_nome: string;
  acao: 'criado' | 'editado' | 'baixado_pdf' | 'baixado_png' | 'compartilhado_whatsapp' | 'copiado';
  detalhes?: string;
}

export interface Quotation {
  id: string;
  numero_sequencial: number; // e.g., 1001
  codigo_proposta: string; // e.g., "PROP-2026-001001"
  workspace_id: string;
  filialId?: string;
  vendedor_id: string;
  vendedor_nome: string;
  data_emissao: string;
  
  // Cliente details copied at quote time
  cliente_codigo: string;
  cliente_razao_social: string;
  cliente_cnpj?: string;
  cliente_endereco: string;
  cliente_bairro: string;
  cliente_cidade: string;
  cliente_uf: string;
  cliente_cep: string;
  cliente_telefone: string;
  cliente_fax?: string;

  // Items and sums
  itens: QuotationItem[];
  subtotal_mercadorias: number;
  outras_despesas?: number; // Optional
  frete?: number; // Optional
  valor_total: number;

  status: 'rascunho' | 'enviado' | 'aprovado' | 'cancelado';
  prazo_pagamento?: string;
  historico: QuotationHistoryEntry[];
}

export interface QuotationDraft {
  workspace_id: string;
  filialId?: string;
  vendedor_id: string;
  editing_quotation_id?: string | null;
  editing_codigo_proposta?: string | null;
  client_search_code: string;
  selected_cliente: Cliente | null;
  proposal_items: QuotationItem[];
  outras_despesas_input: string;
  frete_input: string;
  prazo_pagamento?: string;
  updated_at: string;
}

export interface AICitation {
  index: number;
  document_id?: string;
  document_name: string;
  source_type?: string;
  source_url?: string;
  snippet: string;
}

export interface AIDocumentChunk {
  id: string;
  document_id: string;
  workspace_id: string;
  document_name: string;
  source_type: string;
  source_url?: string;
  chunk_index: number;
  content: string;
  similarity?: number;
}

export interface AIDocument {
  id: string;
  workspace_id: string;
  filialId?: string;
  nome: string;
  tipo: 'pdf' | 'texto' | 'md' | 'web' | 'youtube' | 'gdocs' | 'gslides' | 'excel' | 'csv' | 'word' | 'powerpoint' | 'imagem' | 'link' | 'video';
  fonte_url?: string;
  conteudo_extraido?: string;
  tamanho?: string;
  total_chunks?: number;
  data_upload: string;
  autor_nome: string;
}

export interface AIMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  sources?: string[]; // Citations from Knowledge Base
  citations?: AICitation[]; // Structured NotebookLM citations
  timestamp: string;
}

export interface AIConversation {
  id: string;
  workspace_id: string;
  filialId?: string;
  usuario_id: string;
  usuario_nome: string;
  titulo: string;
  mensagens: AIMessage[];
  criado_em: string;
  atualizado_em: string;
}

export interface ImportRecord {
  id: string;
  workspace_id: string;
  filialId?: string;
  arquivo_nome: string;
  tipo: 'produtos' | 'usuarios' | 'clientes';
  status: 'sucesso' | 'sucesso_parcial' | 'erro';
  total_registros: number;
  erros_qtd: number;
  mensagens_erro?: string[];
  data: string;
  autor_nome: string;
}

export interface AuditLog {
  id: string;
  workspace_id: string;
  filialId?: string;
  usuario_nome: string;
  usuario_role?: UserRole;
  acao: string;
  tipo_acao?: 'criacao' | 'edicao' | 'exclusao' | 'outros';
  modulo: 'Clientes' | 'Produtos' | 'Orçamentos' | 'Feed' | 'Especialista IA' | 'Workspace' | 'Sistema' | string;
  data: string;
  ip_ou_detalhe?: string;
}

export interface NotificationItem {
  id: string;
  workspace_id: string;
  filialId?: string;
  titulo: string;
  mensagem: string;
  tipo: 'feed' | 'orcamento' | 'ai_doc' | 'sistema';
  target_roles?: UserRole[];
  target_user_id?: string;
  lida: boolean;
  data: string;
  link_tab?: string;
  entidade_id?: string;
}


