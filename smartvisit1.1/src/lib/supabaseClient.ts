import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Cliente, Produto, User, Quotation, FeedPost, Workspace, EmpresaEmitente } from '../types';
import { INITIAL_CLIENTES, INITIAL_PRODUTOS } from '../data/initialData';

// Credenciais configuradas (com fallbacks garantidos para execução em produção na Vercel)
const SUPABASE_URL = 
  (import.meta.env.VITE_SUPABASE_URL as string) || 
  'https://skspowdknpfudfnwekfn.supabase.co';

const SUPABASE_ANON_KEY = 
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrc3Bvd2RrbnBmdWRmbndla2ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4ODcyMzAsImV4cCI6MjEwMTQ2MzIzMH0.V8WSafKRfmuqlKRyeVdfDmilzH4BZaAg3NzvtFDbv5Q';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    }
  }
});

// ==============================================================================
// 1. CLIENTES (CRUD SUPABASE EM TEMPO REAL)
// ==============================================================================
export async function getClientesFromSupabase(workspaceId?: string): Promise<Cliente[]> {
  try {
    let query = supabase.from('clientes').select('*');
    if (workspaceId && workspaceId !== 'ALL') {
      query = query.eq('workspace_id', workspaceId);
    }
    const { data, error } = await query.order('razao_social', { ascending: true });
    if (error) {
      console.warn('Erro ao carregar clientes do Supabase:', error.message);
      return [];
    }
    return (data || []).map(row => ({
      id: row.id,
      workspace_id: row.workspace_id,
      filialId: row.filial_id || row.workspace_id,
      codigo: row.codigo,
      razao_social: row.razao_social,
      cnpj: row.cnpj || '',
      cpf_cnpj: row.cpf_cnpj || row.cnpj || '',
      endereco: row.endereco || '',
      bairro: row.bairro || '',
      cidade: row.cidade || '',
      uf: row.uf || '',
      cep: row.cep || '',
      telefone: row.telefone || '',
      fax: row.fax || '',
    }));
  } catch (err) {
    console.error('Falha de rede ao buscar clientes no Supabase:', err);
    return [];
  }
}

export async function insertClienteToSupabase(cli: Cliente): Promise<Cliente> {
  const payload = {
    id: cli.id,
    workspace_id: cli.workspace_id,
    filial_id: cli.filialId || cli.workspace_id,
    codigo: cli.codigo.trim().toUpperCase(),
    razao_social: cli.razao_social.trim(),
    cnpj: cli.cnpj || cli.cpf_cnpj || null,
    cpf_cnpj: cli.cpf_cnpj || cli.cnpj || null,
    endereco: cli.endereco || null,
    bairro: cli.bairro || null,
    cidade: cli.cidade || null,
    uf: cli.uf || null,
    cep: cli.cep || null,
    telefone: cli.telefone || null,
    fax: cli.fax || null,
  };

  const { data, error } = await supabase
    .from('clientes')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Erro ao inserir/atualizar cliente no Supabase:', error.message);
    throw new Error(error.message);
  }
  return {
    ...cli,
    id: data.id,
  };
}

export async function deleteClienteFromSupabase(clienteId: string): Promise<void> {
  const { error } = await supabase.from('clientes').delete().eq('id', clienteId);
  if (error) {
    console.error('Erro ao deletar cliente no Supabase:', error.message);
    throw new Error(error.message);
  }
}

export async function clearClientesFromSupabase(workspaceId: string): Promise<void> {
  const { error } = await supabase.from('clientes').delete().eq('workspace_id', workspaceId);
  if (error) {
    console.error('Erro ao limpar clientes no Supabase:', error.message);
    throw new Error(error.message);
  }
}

export async function seedInitialClientesToSupabase(workspaceId: string): Promise<Cliente[]> {
  let seeds = INITIAL_CLIENTES.filter(c => c.workspace_id === workspaceId);
  if (seeds.length === 0) {
    seeds = INITIAL_CLIENTES.filter(c => c.workspace_id === 'ws-pi100').map((c, i) => ({
      ...c,
      id: `cli-${workspaceId}-${i + 1}`,
      workspace_id: workspaceId,
      filialId: workspaceId,
    }));
  }
  if (seeds.length === 0) return [];

  const payloads = seeds.map(c => ({
    id: c.id,
    workspace_id: workspaceId,
    filial_id: workspaceId,
    codigo: c.codigo,
    razao_social: c.razao_social,
    cnpj: c.cnpj || c.cpf_cnpj || null,
    cpf_cnpj: c.cpf_cnpj || c.cnpj || null,
    endereco: c.endereco || null,
    bairro: c.bairro || null,
    cidade: c.cidade || null,
    uf: c.uf || null,
    cep: c.cep || null,
    telefone: c.telefone || null,
    fax: c.fax || null,
  }));

  const { error } = await supabase.from('clientes').upsert(payloads, { onConflict: 'id' });
  if (error) {
    console.error('Erro ao semear clientes iniciais no Supabase:', error.message);
    throw new Error(error.message);
  }
  return getClientesFromSupabase(workspaceId);
}

// ==============================================================================
// 2. PRODUTOS (CRUD SUPABASE EM TEMPO REAL)
// ==============================================================================
export async function getProdutosFromSupabase(workspaceId?: string): Promise<Produto[]> {
  try {
    let query = supabase.from('produtos').select('*');
    if (workspaceId && workspaceId !== 'ALL') {
      query = query.eq('workspace_id', workspaceId);
    }
    const { data, error } = await query.order('descricao', { ascending: true });
    if (error) {
      console.warn('Erro ao carregar produtos do Supabase:', error.message);
      return [];
    }
    return (data || []).map(row => ({
      id: row.id,
      workspace_id: row.workspace_id,
      filialId: row.filial_id || row.workspace_id,
      codigo: row.codigo,
      descricao: row.descricao,
      embalagem: row.embalagem || 'UN',
      preco_base: typeof row.preco_base === 'number' ? row.preco_base : parseFloat(row.preco_base || '0'),
    }));
  } catch (err) {
    console.error('Falha de rede ao buscar produtos no Supabase:', err);
    return [];
  }
}

export async function insertProdutoToSupabase(prod: Produto): Promise<Produto> {
  const payload = {
    id: prod.id,
    workspace_id: prod.workspace_id,
    filial_id: prod.filialId || prod.workspace_id,
    codigo: prod.codigo.trim().toUpperCase(),
    descricao: prod.descricao.trim(),
    embalagem: (prod.embalagem || 'UN').trim().toUpperCase(),
    preco_base: Number(prod.preco_base) >= 0 ? Number(prod.preco_base) : 0,
  };

  const { data, error } = await supabase
    .from('produtos')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Erro ao inserir/atualizar produto no Supabase:', error.message);
    throw new Error(error.message);
  }
  return {
    ...prod,
    id: data.id,
  };
}

export async function deleteProdutoFromSupabase(produtoId: string): Promise<void> {
  const { error } = await supabase.from('produtos').delete().eq('id', produtoId);
  if (error) {
    console.error('Erro ao deletar produto no Supabase:', error.message);
    throw new Error(error.message);
  }
}

export async function clearProdutosFromSupabase(workspaceId: string): Promise<void> {
  const { error } = await supabase.from('produtos').delete().eq('workspace_id', workspaceId);
  if (error) {
    console.error('Erro ao limpar produtos no Supabase:', error.message);
    throw new Error(error.message);
  }
}

export async function seedInitialProdutosToSupabase(workspaceId: string): Promise<Produto[]> {
  let seeds = INITIAL_PRODUTOS.filter(p => p.workspace_id === workspaceId);
  if (seeds.length === 0) {
    seeds = INITIAL_PRODUTOS.filter(p => p.workspace_id === 'ws-pi100').map((p, i) => ({
      ...p,
      id: `prod-${workspaceId}-${i + 1}`,
      workspace_id: workspaceId,
      filialId: workspaceId,
    }));
  }
  if (seeds.length === 0) return [];

  const payloads = seeds.map(p => ({
    id: p.id,
    workspace_id: workspaceId,
    filial_id: workspaceId,
    codigo: p.codigo,
    descricao: p.descricao,
    embalagem: p.embalagem || 'UN',
    preco_base: p.preco_base,
  }));

  const { error } = await supabase.from('produtos').upsert(payloads, { onConflict: 'id' });
  if (error) {
    console.error('Erro ao semear produtos iniciais no Supabase:', error.message);
    throw new Error(error.message);
  }
  return getProdutosFromSupabase(workspaceId);
}

// ==============================================================================
// 3. USUÁRIOS (CRUD SUPABASE EM TEMPO REAL)
// ==============================================================================
export async function getUsersFromSupabase(workspaceId?: string): Promise<User[]> {
  try {
    let query = supabase.from('usuarios').select('*');
    if (workspaceId && workspaceId !== 'ALL') {
      query = query.or(`workspace_id.eq.${workspaceId},role.eq.diretor`);
    }
    const { data, error } = await query.order('nome', { ascending: true });
    if (error) {
      console.warn('Erro ao carregar usuários do Supabase:', error.message);
      return [];
    }
    return (data || []).map(row => ({
      id: row.id,
      login: row.login,
      senha: row.senha || '123',
      nome: row.nome,
      setor: row.setor || '',
      role: row.role,
      workspace_id: row.workspace_id,
      filialId: row.filial_id || row.workspace_id,
      avatar_url: row.avatar_url || '',
      created_at: row.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.error('Falha de rede ao buscar usuários no Supabase:', err);
    return [];
  }
}

export async function insertUserToSupabase(user: User): Promise<User> {
  const payload = {
    id: user.id,
    login: user.login.trim().toLowerCase(),
    senha: user.senha || '123',
    nome: user.nome.trim(),
    setor: user.setor || 'Vendas',
    role: user.role,
    workspace_id: user.workspace_id,
    filial_id: user.filialId || user.workspace_id,
    avatar_url: user.avatar_url || null,
    ativo: true,
  };

  const { data, error } = await supabase
    .from('usuarios')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Erro ao inserir/atualizar usuário no Supabase:', error.message);
    throw new Error(error.message);
  }
  return {
    ...user,
    id: data.id,
  };
}

export async function deleteUserFromSupabase(userId: string): Promise<void> {
  const { error } = await supabase.from('usuarios').delete().eq('id', userId);
  if (error) {
    console.error('Erro ao deletar usuário no Supabase:', error.message);
    throw new Error(error.message);
  }
}

export async function deleteAllUsersFromSupabase(workspaceId: string, currentUserId?: string): Promise<void> {
  let query = supabase.from('usuarios').delete().eq('workspace_id', workspaceId).neq('role', 'diretor');
  if (currentUserId) {
    query = query.neq('id', currentUserId);
  }
  const { error } = await query;
  if (error) {
    console.error('Erro ao deletar usuários no Supabase:', error.message);
    throw new Error(error.message);
  }
}

export async function verifyUserLoginInSupabase(login: string, senha: string): Promise<User | null> {
  try {
    const cleanLogin = login.trim().toLowerCase().replace(/^@/, '');
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .ilike('login', cleanLogin)
      .eq('senha', senha.trim())
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      id: row.id,
      login: row.login,
      senha: row.senha || '123',
      nome: row.nome,
      setor: row.setor || '',
      role: row.role,
      workspace_id: row.workspace_id,
      filialId: row.filial_id || row.workspace_id,
      avatar_url: row.avatar_url || '',
      created_at: row.created_at || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Erro ao verificar login no Supabase:', err);
    return null;
  }
}

// ==============================================================================
// 4. FILIAIS / WORKSPACES & DADOS DA EMPRESA (CRUD SUPABASE)
// ==============================================================================
export async function getFiliaisFromSupabase(): Promise<{ workspaces: Workspace[]; empresas: Record<string, EmpresaEmitente> }> {
  try {
    const { data, error } = await supabase.from('filiais').select('*').order('nome', { ascending: true });
    if (error) {
      console.warn('Erro ao carregar filiais do Supabase:', error.message);
      return { workspaces: [], empresas: {} };
    }

    const workspaces: Workspace[] = [];
    const empresas: Record<string, EmpresaEmitente> = {};

    (data || []).forEach(row => {
      workspaces.push({
        id: row.id,
        filialId: row.filial_id || row.id,
        nome: row.nome,
        cnpj: row.cnpj || '',
        gerente_id: row.gerente_id || undefined,
        gerente_nome: row.gerente_nome || undefined,
        primary_color: row.primary_color || '#1e40af',
        logo_url: row.logo_url || undefined,
        created_at: row.created_at || new Date().toISOString(),
      });

      empresas[row.id] = {
        workspace_id: row.id,
        filialId: row.filial_id || row.id,
        razao_social: row.razao_social || row.nome,
        cnpj: row.cnpj || '',
        endereco: row.endereco || '',
        bairro: row.bairro || '',
        municipio: row.municipio || '',
        uf: row.uf || '',
        cep: row.cep || '',
        telefone: row.telefone || '',
        fax: row.fax || '',
        inscricao_estadual: row.inscricao_estadual || 'ISENTO',
        whatsapp_default: row.whatsapp_default || '',
        logo_url: row.logo_url || undefined,
      };
    });

    return { workspaces, empresas };
  } catch (err) {
    console.error('Falha de rede ao buscar filiais no Supabase:', err);
    return { workspaces: [], empresas: {} };
  }
}

export async function insertFilialToSupabase(ws: Workspace): Promise<Workspace> {
  const payload = {
    id: ws.id,
    filial_id: ws.filialId || ws.id,
    nome: ws.nome,
    cnpj: ws.cnpj,
    gerente_id: ws.gerente_id || null,
    gerente_nome: ws.gerente_nome || null,
    primary_color: ws.primary_color || '#1e40af',
    logo_url: ws.logo_url || null,
  };

  const { data, error } = await supabase
    .from('filiais')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar filial no Supabase:', error.message);
    throw new Error(error.message);
  }
  return {
    ...ws,
    id: data.id,
  };
}

export async function updateEmpresaEmitenteInSupabase(emp: EmpresaEmitente, wsNome?: string): Promise<void> {
  const payload: Record<string, any> = {
    razao_social: emp.razao_social,
    cnpj: emp.cnpj,
    endereco: emp.endereco,
    bairro: emp.bairro,
    municipio: emp.municipio,
    uf: emp.uf,
    cep: emp.cep,
    telefone: emp.telefone,
    fax: emp.fax || null,
    inscricao_estadual: emp.inscricao_estadual,
    whatsapp_default: emp.whatsapp_default || null,
    logo_url: emp.logo_url || null,
    updated_at: new Date().toISOString(),
  };

  if (wsNome) {
    payload.nome = wsNome;
  }

  const { error } = await supabase.from('filiais').update(payload).eq('id', emp.workspace_id);
  if (error) {
    console.error('Erro ao atualizar dados da empresa no Supabase:', error.message);
    throw new Error(error.message);
  }
}

export async function deleteFilialFromSupabase(workspaceId: string): Promise<void> {
  const { error } = await supabase.from('filiais').delete().eq('id', workspaceId);
  if (error) {
    console.error('Erro ao deletar filial no Supabase:', error.message);
    throw new Error(error.message);
  }
}

// ==============================================================================
// 5. ORÇAMENTOS / PROPOSTAS COMERCIAIS (CRUD SUPABASE EM TEMPO REAL)
// ==============================================================================
export async function getQuotationsFromSupabase(workspaceId?: string, currentUser?: User | null): Promise<Quotation[]> {
  try {
    let query = supabase.from('orcamentos').select('*');
    if (workspaceId && workspaceId !== 'ALL') {
      query = query.eq('workspace_id', workspaceId);
    }
    const { data, error } = await query.order('numero_sequencial', { ascending: false });
    if (error) {
      console.warn('Erro ao carregar orçamentos do Supabase:', error.message);
      return [];
    }

    const list: Quotation[] = (data || []).map(row => ({
      id: row.id,
      numero_sequencial: Number(row.numero_sequencial),
      codigo_proposta: row.codigo_proposta,
      workspace_id: row.workspace_id,
      filialId: row.filial_id || row.workspace_id,
      vendedor_id: row.vendedor_id,
      vendedor_nome: row.vendedor_nome,
      data_emissao: row.data_emissao,
      cliente_codigo: row.cliente_codigo,
      cliente_razao_social: row.cliente_razao_social,
      cliente_cnpj: row.cliente_cnpj || '',
      cliente_endereco: row.cliente_endereco || '',
      cliente_bairro: row.cliente_bairro || '',
      cliente_cidade: row.cliente_cidade || '',
      cliente_uf: row.cliente_uf || '',
      cliente_cep: row.cliente_cep || '',
      cliente_telefone: row.cliente_telefone || '',
      cliente_fax: row.cliente_fax || '',
      itens: Array.isArray(row.itens) ? row.itens : [],
      subtotal_mercadorias: Number(row.subtotal_mercadorias || 0),
      outras_despesas: Number(row.outras_despesas || 0),
      frete: Number(row.frete || 0),
      valor_total: Number(row.valor_total || 0),
      status: row.status || 'rascunho',
      prazo_pagamento: row.prazo_pagamento || '',
      historico: Array.isArray(row.historico) ? row.historico : [],
    }));

    if (!currentUser) return list;
    if (currentUser.role === 'vendedor') {
      return list.filter(q => q.vendedor_id === currentUser.id);
    }
    return list;
  } catch (err) {
    console.error('Falha de rede ao buscar orçamentos no Supabase:', err);
    return [];
  }
}

export async function insertQuotationToSupabase(q: Quotation): Promise<Quotation> {
  const payload = {
    id: q.id,
    numero_sequencial: q.numero_sequencial,
    codigo_proposta: q.codigo_proposta,
    workspace_id: q.workspace_id,
    filial_id: q.filialId || q.workspace_id,
    vendedor_id: q.vendedor_id,
    vendedor_nome: q.vendedor_nome,
    data_emissao: q.data_emissao || new Date().toISOString(),
    cliente_codigo: q.cliente_codigo,
    cliente_razao_social: q.cliente_razao_social,
    cliente_cnpj: q.cliente_cnpj || null,
    cliente_endereco: q.cliente_endereco || null,
    cliente_bairro: q.cliente_bairro || null,
    cliente_cidade: q.cliente_cidade || null,
    cliente_uf: q.cliente_uf || null,
    cliente_cep: q.cliente_cep || null,
    cliente_telefone: q.cliente_telefone || null,
    cliente_fax: q.cliente_fax || null,
    itens: q.itens || [],
    subtotal_mercadorias: q.subtotal_mercadorias,
    outras_despesas: q.outras_despesas || 0,
    frete: q.frete || 0,
    valor_total: q.valor_total,
    status: q.status,
    prazo_pagamento: q.prazo_pagamento || null,
    historico: q.historico || [],
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('orcamentos')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar orçamento no Supabase:', error.message);
    throw new Error(error.message);
  }
  return {
    ...q,
    id: data.id,
  };
}

export async function deleteQuotationFromSupabase(quotationId: string): Promise<void> {
  const { error } = await supabase.from('orcamentos').delete().eq('id', quotationId);
  if (error) {
    console.error('Erro ao deletar orçamento no Supabase:', error.message);
    throw new Error(error.message);
  }
}

// ==============================================================================
// 6. FEED POSTS (COMUNICADOS & METAS) (CRUD SUPABASE EM TEMPO REAL)
// ==============================================================================
export async function getFeedPostsFromSupabase(workspaceId?: string, currentUser?: User | null): Promise<FeedPost[]> {
  try {
    const { data, error } = await supabase
      .from('feed_posts')
      .select('*')
      .order('fixado', { ascending: false })
      .order('data', { ascending: false });

    if (error) {
      console.warn('Erro ao carregar feed posts do Supabase:', error.message);
      return [];
    }

    const all: FeedPost[] = (data || []).map(row => ({
      id: row.id,
      workspace_id: row.workspace_id,
      filialId: row.filial_id || row.workspace_id,
      autor_id: row.autor_id,
      autor_nome: row.autor_nome,
      autor_role: row.autor_role,
      autor_avatar_url: row.autor_avatar_url || '',
      target_workspace_ids: Array.isArray(row.target_workspace_ids) ? row.target_workspace_ids : ['ALL'],
      data: row.data,
      legenda: row.legenda,
      imagens: Array.isArray(row.imagens) ? row.imagens : [],
      arquivos: Array.isArray(row.arquivos) ? row.arquivos : [],
      fixado: Boolean(row.fixado),
      reacoes: Array.isArray(row.reacoes) ? row.reacoes : [],
    }));

    if (!currentUser || currentUser.role === 'diretor') {
      if (!workspaceId || workspaceId === 'ALL') return all;
      return all.filter(p => {
        if (p.target_workspace_ids && p.target_workspace_ids.length > 0) {
          return p.target_workspace_ids.includes('ALL') || p.target_workspace_ids.includes(workspaceId);
        }
        return p.workspace_id === workspaceId;
      });
    }

    const userWs = currentUser.workspace_id || currentUser.filialId || workspaceId;
    return all.filter(p => {
      if (p.target_workspace_ids && p.target_workspace_ids.length > 0) {
        return p.target_workspace_ids.includes('ALL') || (userWs && p.target_workspace_ids.includes(userWs));
      }
      return p.workspace_id === userWs;
    });
  } catch (err) {
    console.error('Falha de rede ao buscar feed posts no Supabase:', err);
    return [];
  }
}

export async function insertFeedPostToSupabase(post: FeedPost): Promise<FeedPost> {
  const payload = {
    id: post.id,
    workspace_id: post.workspace_id,
    filial_id: post.filialId || post.workspace_id,
    autor_id: post.autor_id,
    autor_nome: post.autor_nome,
    autor_role: post.autor_role,
    autor_avatar_url: post.autor_avatar_url || null,
    target_workspace_ids: post.target_workspace_ids || ['ALL'],
    data: post.data || new Date().toISOString(),
    legenda: post.legenda,
    imagens: post.imagens || [],
    arquivos: post.arquivos || [],
    fixado: Boolean(post.fixado),
    reacoes: post.reacoes || [],
  };

  const { data, error } = await supabase
    .from('feed_posts')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar post no Supabase:', error.message);
    throw new Error(error.message);
  }
  return {
    ...post,
    id: data.id,
  };
}

export async function updateFeedPostReactionInSupabase(postId: string, reacoes: any[]): Promise<void> {
  const { error } = await supabase.from('feed_posts').update({ reacoes }).eq('id', postId);
  if (error) {
    console.error('Erro ao atualizar reações no Supabase:', error.message);
    throw new Error(error.message);
  }
}

export async function deleteFeedPostFromSupabase(postId: string): Promise<void> {
  const { error } = await supabase.from('feed_posts').delete().eq('id', postId);
  if (error) {
    console.error('Erro ao deletar post no Supabase:', error.message);
    throw new Error(error.message);
  }
}
