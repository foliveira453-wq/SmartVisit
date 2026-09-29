import {
  Workspace,
  User,
  EmpresaEmitente,
  Cliente,
  Produto,
  FeedPost,
  Quotation,
  QuotationItem,
  QuotationDraft,
  AIDocument,
  AIConversation,
  ImportRecord,
  AuditLog,
  NotificationItem,
  UserRole
} from '../types';
import {
  INITIAL_WORKSPACES,
  INITIAL_USERS,
  INITIAL_EMPRESA_EMITENTE,
  INITIAL_CLIENTES,
  INITIAL_PRODUTOS,
  INITIAL_FEED_POSTS,
  INITIAL_QUOTATIONS,
  INITIAL_AI_DOCUMENTS,
  INITIAL_AI_CONVERSATIONS,
  INITIAL_IMPORTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS
} from '../data/initialData';
import {
  getClientesFromSupabase,
  insertClienteToSupabase,
  deleteClienteFromSupabase,
  clearClientesFromSupabase,
  getProdutosFromSupabase,
  insertProdutoToSupabase,
  deleteProdutoFromSupabase,
  clearProdutosFromSupabase,
  getUsersFromSupabase,
  insertUserToSupabase,
  deleteUserFromSupabase,
  deleteAllUsersFromSupabase,
  getFiliaisFromSupabase,
  insertFilialToSupabase,
  deleteFilialFromSupabase,
  updateEmpresaEmitenteInSupabase,
  getQuotationsFromSupabase,
  insertQuotationToSupabase,
  deleteQuotationFromSupabase,
  getFeedPostsFromSupabase,
  insertFeedPostToSupabase,
  deleteFeedPostFromSupabase,
} from './supabaseClient';

const STORAGE_KEYS = {
  CURRENT_USER: 'smartvisit_current_user',
  ACTIVE_WORKSPACE_ID: 'smartvisit_active_ws_id',
  ACTIVE_TAB: 'smartvisit_active_tab',
  WORKSPACES: 'smartvisit_workspaces',
  USERS: 'smartvisit_users',
  EMPRESA_EMITENTE: 'smartvisit_empresa_emitente',
  CLIENTES: 'smartvisit_clientes',
  PRODUTOS: 'smartvisit_produtos',
  FEED_POSTS: 'smartvisit_feed_posts',
  QUOTATIONS: 'smartvisit_quotations',
  AI_DOCUMENTS: 'smartvisit_ai_documents',
  AI_CONVERSATIONS: 'smartvisit_ai_conversations',
  IMPORTS: 'smartvisit_imports',
  AUDIT_LOGS: 'smartvisit_audit_logs',
  NOTIFICATIONS: 'smartvisit_notifications',
  QUOTATION_DRAFTS: 'smartvisit_quotation_drafts',
};

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    if (!data) return defaultValue;
    return JSON.parse(data) as T;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage`, err);
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to localStorage`, err);
  }
}

export class StorageService {
  // Initialization & Cloud Sync
  static init(): void {
    if (!localStorage.getItem(STORAGE_KEYS.WORKSPACES)) {
      setItem(STORAGE_KEYS.WORKSPACES, INITIAL_WORKSPACES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      setItem(STORAGE_KEYS.USERS, INITIAL_USERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.EMPRESA_EMITENTE)) {
      setItem(STORAGE_KEYS.EMPRESA_EMITENTE, INITIAL_EMPRESA_EMITENTE);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CLIENTES)) {
      setItem(STORAGE_KEYS.CLIENTES, INITIAL_CLIENTES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PRODUTOS)) {
      setItem(STORAGE_KEYS.PRODUTOS, INITIAL_PRODUTOS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.FEED_POSTS)) {
      setItem(STORAGE_KEYS.FEED_POSTS, INITIAL_FEED_POSTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.QUOTATIONS)) {
      setItem(STORAGE_KEYS.QUOTATIONS, INITIAL_QUOTATIONS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AI_DOCUMENTS)) {
      setItem(STORAGE_KEYS.AI_DOCUMENTS, INITIAL_AI_DOCUMENTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AI_CONVERSATIONS)) {
      setItem(STORAGE_KEYS.AI_CONVERSATIONS, INITIAL_AI_CONVERSATIONS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.IMPORTS)) {
      setItem(STORAGE_KEYS.IMPORTS, INITIAL_IMPORTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      setItem(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
      setItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    }

    // Dispara sincronização em nuvem com Supabase imediatamente em segundo plano
    this.syncAllFromSupabase().catch(err => {
      console.warn('Sincronização inicial com Supabase em background falhou:', err);
    });
  }

  // Sincroniza todas as tabelas principais diretamente com o Supabase
  static async syncAllFromSupabase(): Promise<void> {
    try {
      const [filiaisData, usersData, clientesData, produtosData, postsData, quotationsData] = await Promise.all([
        getFiliaisFromSupabase(),
        getUsersFromSupabase('ALL'),
        getClientesFromSupabase('ALL'),
        getProdutosFromSupabase('ALL'),
        getFeedPostsFromSupabase('ALL'),
        getQuotationsFromSupabase('ALL'),
      ]);

      if (filiaisData.workspaces && filiaisData.workspaces.length > 0) {
        setItem(STORAGE_KEYS.WORKSPACES, filiaisData.workspaces);
      }
      if (filiaisData.empresas && Object.keys(filiaisData.empresas).length > 0) {
        const currentEmpresas = getItem<Record<string, EmpresaEmitente>>(STORAGE_KEYS.EMPRESA_EMITENTE, {});
        setItem(STORAGE_KEYS.EMPRESA_EMITENTE, { ...currentEmpresas, ...filiaisData.empresas });
      }
      if (usersData && usersData.length > 0) {
        setItem(STORAGE_KEYS.USERS, usersData);
      }
      if (clientesData && clientesData.length > 0) {
        setItem(STORAGE_KEYS.CLIENTES, clientesData);
      }
      if (produtosData && produtosData.length > 0) {
        setItem(STORAGE_KEYS.PRODUTOS, produtosData);
      }
      if (postsData && postsData.length > 0) {
        setItem(STORAGE_KEYS.FEED_POSTS, postsData);
      }
      if (quotationsData && quotationsData.length > 0) {
        setItem(STORAGE_KEYS.QUOTATIONS, quotationsData);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('smartvisit_supabase_synced'));
        window.dispatchEvent(new Event('smartvisit_workspaces_updated'));
        window.dispatchEvent(new Event('smartvisit_user_updated'));
        window.dispatchEvent(new Event('smartvisit_clientes_updated'));
        window.dispatchEvent(new Event('smartvisit_produtos_updated'));
        window.dispatchEvent(new Event('smartvisit_feed_updated'));
        window.dispatchEvent(new Event('smartvisit_quotations_updated'));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabelas do Supabase:', err);
    }
  }

  // Auth / Current User Session
  static getCurrentUser(): User | null {
    return getItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
  }

  static setCurrentUser(user: User | null): void {
    setItem(STORAGE_KEYS.CURRENT_USER, user);
    if (user) {
      if (user.role !== 'diretor') {
        this.setActiveWorkspaceId(user.workspace_id || user.filialId || 'ws-pi100');
      }
    }
  }

  static getActiveWorkspaceId(): string | null {
    return getItem<string | null>(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, null);
  }

  static setActiveWorkspaceId(workspaceId: string): void {
    setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, workspaceId);
  }

  static getActiveTab(): string | null {
    return getItem<string | null>(STORAGE_KEYS.ACTIVE_TAB, null);
  }

  static setActiveTab(tab: string): void {
    setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
  }

  // Workspaces
  static getWorkspaces(): Workspace[] {
    const list = getItem<Workspace[]>(STORAGE_KEYS.WORKSPACES, INITIAL_WORKSPACES);
    const globalLogo = this.getCompanyLogo();
    if (globalLogo) {
      return list.map(w => ({ ...w, logo_url: globalLogo }));
    }
    return list;
  }

  static saveWorkspace(workspace: Workspace): void {
    const globalLogo = this.getCompanyLogo();
    const list = getItem<Workspace[]>(STORAGE_KEYS.WORKSPACES, INITIAL_WORKSPACES);
    const idx = list.findIndex(w => w.id === workspace.id);
    const wsToSave = { ...workspace, logo_url: globalLogo || workspace.logo_url };
    if (idx >= 0) {
      list[idx] = wsToSave;
    } else {
      list.push(wsToSave);
    }
    setItem(STORAGE_KEYS.WORKSPACES, list);

    // Persistência em nuvem no Supabase
    insertFilialToSupabase(wsToSave).catch(err => {
      console.warn('Erro ao sincronizar filial com Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_workspaces_updated'));
    }
  }

  static deleteWorkspace(workspaceId: string): void {
    let list = getItem<Workspace[]>(STORAGE_KEYS.WORKSPACES, INITIAL_WORKSPACES);
    list = list.filter(w => w.id !== workspaceId);
    setItem(STORAGE_KEYS.WORKSPACES, list);

    let users = getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    users = users.filter(u => u.workspace_id !== workspaceId || u.role === 'diretor');
    setItem(STORAGE_KEYS.USERS, users);

    const drafts = getItem<Record<string, QuotationDraft>>(STORAGE_KEYS.QUOTATION_DRAFTS, {});
    Object.keys(drafts).forEach(k => {
      if (drafts[k]?.workspace_id === workspaceId) {
        delete drafts[k];
      }
    });
    setItem(STORAGE_KEYS.QUOTATION_DRAFTS, drafts);

    // Remoção em nuvem no Supabase
    deleteFilialFromSupabase(workspaceId).catch(err => {
      console.warn('Erro ao deletar filial do Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_workspaces_updated'));
    }
  }

  // Global Unified Company Logo
  static getCompanyLogo(): string {
    const raw = localStorage.getItem('smartvisit_global_company_logo');
    if (raw !== null) {
      try {
        return JSON.parse(raw) as string;
      } catch {
        return '';
      }
    }
    return '';
  }

  static saveCompanyLogo(logoDataUrl: string): void {
    setItem('smartvisit_global_company_logo', logoDataUrl);

    const list = getItem<Workspace[]>(STORAGE_KEYS.WORKSPACES, INITIAL_WORKSPACES);
    const updatedWorkspaces = list.map(w => ({ ...w, logo_url: logoDataUrl || undefined }));
    setItem(STORAGE_KEYS.WORKSPACES, updatedWorkspaces);

    const map = getItem<Record<string, EmpresaEmitente>>(
      STORAGE_KEYS.EMPRESA_EMITENTE,
      INITIAL_EMPRESA_EMITENTE
    );
    Object.keys(map).forEach(wsId => {
      map[wsId].logo_url = logoDataUrl || undefined;
      updateEmpresaEmitenteInSupabase(map[wsId]).catch(err => console.warn(err));
    });
    setItem(STORAGE_KEYS.EMPRESA_EMITENTE, map);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_company_logo_updated'));
    }
  }

  // Users
  static getUsers(workspaceId?: string, currentUser?: User | null): User[] {
    const all = getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    if (!currentUser) {
      if (!workspaceId || workspaceId === 'ALL') return all;
      return all.filter(u => u.workspace_id === workspaceId);
    }

    if (currentUser.role === 'diretor') {
      if (!workspaceId || workspaceId === 'ALL') return all;
      return all.filter(u => u.workspace_id === workspaceId);
    }

    const userWs = currentUser.workspace_id || currentUser.filialId;
    return all.filter(u => (u.workspace_id === userWs || u.filialId === userWs));
  }

  static isDuplicateUserName(nome: string, excludeUserId?: string): boolean {
    if (!nome || !nome.trim()) return false;
    const targetName = nome.trim().toLowerCase();
    const allUsers = this.getUsers();
    return allUsers.some(u => u.id !== excludeUserId && u.nome.trim().toLowerCase() === targetName);
  }

  static isDuplicateUserLogin(login: string, excludeUserId?: string): boolean {
    if (!login || !login.trim()) return false;
    const targetLogin = login.trim().toLowerCase().replace(/^@/, '');
    const allUsers = this.getUsers();
    return allUsers.some(u => u.id !== excludeUserId && u.login.trim().toLowerCase().replace(/^@/, '') === targetLogin);
  }

  static saveUser(user: User): void {
    const list = getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const idx = list.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      list[idx] = user;
    } else {
      list.push(user);
    }
    setItem(STORAGE_KEYS.USERS, list);

    const activeUser = this.getCurrentUser();
    if (!activeUser || activeUser.id === user.id) {
      this.setCurrentUser(user);
    }

    // Persistência em nuvem no Supabase
    insertUserToSupabase(user).catch(err => {
      console.warn('Erro ao sincronizar usuário com Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_user_updated'));
    }
  }

  static deleteUser(userId: string): void {
    let list = getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    list = list.filter(u => u.id !== userId);
    setItem(STORAGE_KEYS.USERS, list);

    // Remoção em nuvem no Supabase
    deleteUserFromSupabase(userId).catch(err => {
      console.warn('Erro ao deletar usuário do Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_user_updated'));
    }
  }

  static deleteAllUsersFromWorkspace(workspaceId: string, currentUserId?: string): number {
    let list = getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const initialCount = list.length;
    list = list.filter(u => {
      if (u.role === 'diretor') return true;
      if (currentUserId && u.id === currentUserId) return true;
      return u.workspace_id !== workspaceId && u.filialId !== workspaceId;
    });
    const deletedCount = initialCount - list.length;
    setItem(STORAGE_KEYS.USERS, list);

    // Remoção em lote no Supabase
    deleteAllUsersFromSupabase(workspaceId, currentUserId).catch(err => {
      console.warn('Erro ao deletar usuários do Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_user_updated'));
    }
    return deletedCount;
  }

  // Empresa Emitente
  static getEmpresaEmitente(workspaceId: string): EmpresaEmitente {
    const map = getItem<Record<string, EmpresaEmitente>>(
      STORAGE_KEYS.EMPRESA_EMITENTE,
      INITIAL_EMPRESA_EMITENTE
    );
    const hasGlobalKey = localStorage.getItem('smartvisit_global_company_logo') !== null;
    const globalLogo = this.getCompanyLogo();
    const emp = map[workspaceId] || {
      workspace_id: workspaceId,
      razao_social: 'Sua Empresa Ltda',
      cnpj: '00.000.000/0001-00',
      endereco: 'Rua Principal, 100',
      bairro: 'Centro',
      municipio: 'São Paulo',
      uf: 'SP',
      cep: '01000-000',
      telefone: '(11) 0000-0000',
      fax: '(11) 0000-0000',
      inscricao_estadual: 'ISENTO',
    };
    return {
      ...emp,
      logo_url: hasGlobalKey ? globalLogo : (emp.logo_url || '')
    };
  }

  static saveEmpresaEmitente(empresa: EmpresaEmitente, wsNome?: string): void {
    const map = getItem<Record<string, EmpresaEmitente>>(
      STORAGE_KEYS.EMPRESA_EMITENTE,
      INITIAL_EMPRESA_EMITENTE
    );
    map[empresa.workspace_id] = empresa;
    setItem(STORAGE_KEYS.EMPRESA_EMITENTE, map);

    // Atualiza tabela filiais no Supabase
    updateEmpresaEmitenteInSupabase(empresa, wsNome).catch(err => {
      console.warn('Erro ao sincronizar dados da empresa no Supabase:', err);
    });
  }

  // Clientes
  static getClientes(workspaceId: string): Cliente[] {
    const all = getItem<Cliente[]>(STORAGE_KEYS.CLIENTES, INITIAL_CLIENTES);
    return all.filter(c => c.workspace_id === workspaceId);
  }

  static getClienteByCodigo(workspaceId: string, codigo: string): Cliente | undefined {
    const list = this.getClientes(workspaceId);
    return list.find(c => c.codigo.trim().toUpperCase() === codigo.trim().toUpperCase());
  }

  static saveCliente(cliente: Cliente): void {
    const all = getItem<Cliente[]>(STORAGE_KEYS.CLIENTES, INITIAL_CLIENTES);
    const idx = all.findIndex(c => c.id === cliente.id);
    if (idx >= 0) {
      all[idx] = cliente;
    } else {
      all.push(cliente);
    }
    setItem(STORAGE_KEYS.CLIENTES, all);

    // Envia direto para o Supabase
    insertClienteToSupabase(cliente).catch(err => {
      console.warn('Erro ao salvar cliente no Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_clientes_updated'));
    }
  }

  static deleteCliente(clienteId: string): void {
    let all = getItem<Cliente[]>(STORAGE_KEYS.CLIENTES, INITIAL_CLIENTES);
    all = all.filter(c => c.id !== clienteId);
    setItem(STORAGE_KEYS.CLIENTES, all);

    // Deleta direto no Supabase
    deleteClienteFromSupabase(clienteId).catch(err => {
      console.warn('Erro ao deletar cliente no Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_clientes_updated'));
    }
  }

  // Produtos
  static getProdutos(workspaceId: string): Produto[] {
    const all = getItem<Produto[]>(STORAGE_KEYS.PRODUTOS, INITIAL_PRODUTOS);
    return all.filter(p => p.workspace_id === workspaceId);
  }

  static getProdutoByCodigo(workspaceId: string, codigo: string): Produto | undefined {
    const list = this.getProdutos(workspaceId);
    return list.find(p => p.codigo.trim().toUpperCase() === codigo.trim().toUpperCase());
  }

  static saveProduto(produto: Produto): void {
    const all = getItem<Produto[]>(STORAGE_KEYS.PRODUTOS, INITIAL_PRODUTOS);
    const idx = all.findIndex(p => p.id === produto.id);
    if (idx >= 0) {
      all[idx] = produto;
    } else {
      all.push(produto);
    }
    setItem(STORAGE_KEYS.PRODUTOS, all);

    // Envia direto para o Supabase
    insertProdutoToSupabase(produto).catch(err => {
      console.warn('Erro ao salvar produto no Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_produtos_updated'));
    }
  }

  static deleteProduto(produtoId: string): void {
    let all = getItem<Produto[]>(STORAGE_KEYS.PRODUTOS, INITIAL_PRODUTOS);
    all = all.filter(p => p.id !== produtoId);
    setItem(STORAGE_KEYS.PRODUTOS, all);

    // Deleta direto no Supabase
    deleteProdutoFromSupabase(produtoId).catch(err => {
      console.warn('Erro ao deletar produto no Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_produtos_updated'));
    }
  }

  static clearAllProdutos(workspaceId: string): void {
    let all = getItem<Produto[]>(STORAGE_KEYS.PRODUTOS, INITIAL_PRODUTOS);
    all = all.filter(p => p.workspace_id !== workspaceId);
    setItem(STORAGE_KEYS.PRODUTOS, all);

    clearProdutosFromSupabase(workspaceId).catch(err => {
      console.warn('Erro ao limpar produtos no Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_produtos_updated'));
    }
  }

  static clearAllClientes(workspaceId: string): void {
    let all = getItem<Cliente[]>(STORAGE_KEYS.CLIENTES, INITIAL_CLIENTES);
    all = all.filter(c => c.workspace_id !== workspaceId);
    setItem(STORAGE_KEYS.CLIENTES, all);

    clearClientesFromSupabase(workspaceId).catch(err => {
      console.warn('Erro ao limpar clientes no Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_clientes_updated'));
    }
  }

  // Feed Posts
  static getFeedPosts(workspaceId: string, currentUser?: User | null): FeedPost[] {
    const all = getItem<FeedPost[]>(STORAGE_KEYS.FEED_POSTS, INITIAL_FEED_POSTS);
    
    let list: FeedPost[];

    if (!currentUser || currentUser.role === 'diretor') {
      if (!workspaceId || workspaceId === 'ALL') {
        list = all;
      } else {
        list = all.filter(p => {
          if (p.target_workspace_ids && p.target_workspace_ids.length > 0) {
            return (
              p.target_workspace_ids.includes('ALL') ||
              p.target_workspace_ids.includes(workspaceId)
            );
          }
          return p.workspace_id === workspaceId || p.filialId === workspaceId;
        });
      }
    } else {
      const userWs = currentUser.workspace_id || currentUser.filialId || workspaceId;
      list = all.filter(p => {
        if (p.target_workspace_ids && p.target_workspace_ids.length > 0) {
          return p.target_workspace_ids.includes('ALL') || p.target_workspace_ids.includes(userWs);
        }
        return p.workspace_id === userWs || p.filialId === userWs;
      });
    }

    return list.sort((a, b) => {
      if (a.fixado && !b.fixado) return -1;
      if (!a.fixado && b.fixado) return 1;
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });
  }

  static saveFeedPost(post: FeedPost): void {
    const all = getItem<FeedPost[]>(STORAGE_KEYS.FEED_POSTS, INITIAL_FEED_POSTS);
    const idx = all.findIndex(p => p.id === post.id);
    if (idx >= 0) {
      all[idx] = post;
    } else {
      all.unshift(post);
    }
    setItem(STORAGE_KEYS.FEED_POSTS, all);

    // Envia direto para o Supabase
    insertFeedPostToSupabase(post).catch(err => {
      console.warn('Erro ao salvar post no Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_feed_updated'));
    }
  }

  static deleteFeedPost(postId: string): void {
    let all = getItem<FeedPost[]>(STORAGE_KEYS.FEED_POSTS, INITIAL_FEED_POSTS);
    all = all.filter(p => p.id !== postId);
    setItem(STORAGE_KEYS.FEED_POSTS, all);

    // Deleta direto no Supabase
    deleteFeedPostFromSupabase(postId).catch(err => {
      console.warn('Erro ao deletar post no Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_feed_updated'));
    }
  }

  static togglePinFeedPost(postId: string): void {
    const all = getItem<FeedPost[]>(STORAGE_KEYS.FEED_POSTS, INITIAL_FEED_POSTS);
    const post = all.find(p => p.id === postId);
    if (post) {
      post.fixado = !post.fixado;
      setItem(STORAGE_KEYS.FEED_POSTS, all);
      insertFeedPostToSupabase(post).catch(err => {
        console.warn('Erro ao atualizar pin do post no Supabase:', err);
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('smartvisit_feed_updated'));
      }
    }
  }

  // Quotations (Orçamentos)
  static getQuotations(workspaceId: string, currentUser?: User | null): Quotation[] {
    const all = getItem<Quotation[]>(STORAGE_KEYS.QUOTATIONS, INITIAL_QUOTATIONS);
    let list: Quotation[];
    
    if (currentUser && currentUser.role === 'vendedor') {
      list = all.filter(q => q.vendedor_id === currentUser.id);
    } else if (currentUser && (currentUser.role === 'gestor' || currentUser.role === 'gerente')) {
      const userWs = currentUser.workspace_id || currentUser.filialId || workspaceId;
      list = all.filter(q => q.workspace_id === userWs || q.filialId === userWs);
    } else if (currentUser && currentUser.role === 'diretor') {
      if (!workspaceId || workspaceId === 'ALL') {
        list = all;
      } else {
        list = all.filter(q => q.workspace_id === workspaceId || q.filialId === workspaceId);
      }
    } else {
      list = all.filter(q => q.workspace_id === workspaceId);
    }
    
    return list.sort((a, b) => new Date(b.data_emissao).getTime() - new Date(a.data_emissao).getTime());
  }

  static getNextQuotationSeq(workspaceId: string): number {
    const all = getItem<Quotation[]>(STORAGE_KEYS.QUOTATIONS, INITIAL_QUOTATIONS);
    const list = all.filter(q => q.workspace_id === workspaceId);
    if (list.length === 0) return 1001;
    const max = Math.max(...list.map(q => q.numero_sequencial || 1000));
    return max + 1;
  }

  static saveQuotation(quotation: Quotation): void {
    const all = getItem<Quotation[]>(STORAGE_KEYS.QUOTATIONS, INITIAL_QUOTATIONS);
    const idx = all.findIndex(q => q.id === quotation.id);
    if (idx >= 0) {
      all[idx] = quotation;
    } else {
      all.unshift(quotation);
    }
    setItem(STORAGE_KEYS.QUOTATIONS, all);

    // Envia direto para o Supabase
    insertQuotationToSupabase(quotation).catch(err => {
      console.warn('Erro ao salvar orçamento no Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_quotations_updated'));
    }
  }

  static deleteQuotation(quotationId: string): void {
    let all = getItem<Quotation[]>(STORAGE_KEYS.QUOTATIONS, INITIAL_QUOTATIONS);
    all = all.filter(q => q.id !== quotationId);
    setItem(STORAGE_KEYS.QUOTATIONS, all);

    // Deleta direto no Supabase
    deleteQuotationFromSupabase(quotationId).catch(err => {
      console.warn('Erro ao deletar orçamento no Supabase:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smartvisit_quotations_updated'));
    }
  }

  // Quotation Drafts
  static getQuotationDraft(workspaceId: string, userId: string): QuotationDraft | null {
    const map = getItem<Record<string, QuotationDraft>>(STORAGE_KEYS.QUOTATION_DRAFTS, {});
    const key = `${workspaceId}_${userId}`;
    return map[key] || null;
  }

  static saveQuotationDraft(draft: QuotationDraft): void {
    const map = getItem<Record<string, QuotationDraft>>(STORAGE_KEYS.QUOTATION_DRAFTS, {});
    const key = `${draft.workspace_id}_${draft.vendedor_id}`;
    map[key] = draft;
    setItem(STORAGE_KEYS.QUOTATION_DRAFTS, map);
  }

  static clearQuotationDraft(workspaceId: string, userId: string): void {
    const map = getItem<Record<string, QuotationDraft>>(STORAGE_KEYS.QUOTATION_DRAFTS, {});
    const key = `${workspaceId}_${userId}`;
    delete map[key];
    setItem(STORAGE_KEYS.QUOTATION_DRAFTS, map);
  }

  // AI Documents
  static getAIDocuments(workspaceId: string): AIDocument[] {
    const all = getItem<AIDocument[]>(STORAGE_KEYS.AI_DOCUMENTS, INITIAL_AI_DOCUMENTS);
    return all.filter(d => d.workspace_id === workspaceId);
  }

  static saveAIDocument(doc: AIDocument): void {
    const all = getItem<AIDocument[]>(STORAGE_KEYS.AI_DOCUMENTS, INITIAL_AI_DOCUMENTS);
    all.push(doc);
    setItem(STORAGE_KEYS.AI_DOCUMENTS, all);
  }

  static deleteAIDocument(docId: string): void {
    let all = getItem<AIDocument[]>(STORAGE_KEYS.AI_DOCUMENTS, INITIAL_AI_DOCUMENTS);
    all = all.filter(d => d.id !== docId);
    setItem(STORAGE_KEYS.AI_DOCUMENTS, all);
  }

  // AI Conversations
  static getAIConversations(workspaceId: string, currentUser?: User | null): AIConversation[] {
    const all = getItem<AIConversation[]>(STORAGE_KEYS.AI_CONVERSATIONS, INITIAL_AI_CONVERSATIONS);
    let list = all.filter(c => c.workspace_id === workspaceId);
    
    if (currentUser && currentUser.role === 'vendedor') {
      list = list.filter(c => c.usuario_id === currentUser.id);
    }
    
    return list.sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime());
  }

  static saveAIConversation(conv: AIConversation): void {
    const all = getItem<AIConversation[]>(STORAGE_KEYS.AI_CONVERSATIONS, INITIAL_AI_CONVERSATIONS);
    const idx = all.findIndex(c => c.id === conv.id);
    if (idx >= 0) {
      all[idx] = conv;
    } else {
      all.unshift(conv);
    }
    setItem(STORAGE_KEYS.AI_CONVERSATIONS, all);
  }

  // Imports
  static getImports(workspaceId: string): ImportRecord[] {
    const all = getItem<ImportRecord[]>(STORAGE_KEYS.IMPORTS, INITIAL_IMPORTS);
    return all.filter(i => i.workspace_id === workspaceId).sort((a, b) =>
      new Date(b.data).getTime() - new Date(a.data).getTime()
    );
  }

  static saveImportRecord(record: ImportRecord): void {
    const all = getItem<ImportRecord[]>(STORAGE_KEYS.IMPORTS, INITIAL_IMPORTS);
    all.unshift(record);
    setItem(STORAGE_KEYS.IMPORTS, all);
  }

  // Audit Logs
  static getAuditLogs(workspaceId: string): AuditLog[] {
    const all = getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    return all.filter(l => l.workspace_id === workspaceId).sort((a, b) =>
      new Date(b.data).getTime() - new Date(a.data).getTime()
    );
  }

  static getAllGlobalAuditLogs(): AuditLog[] {
    const all = getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    return all.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }

  static getUsersByWorkspace(workspaceId: string): User[] {
    const all = getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    return all.filter(u => u.workspace_id === workspaceId);
  }

  static logAudit(
    workspaceId: string, 
    usuarioNome: string, 
    acao: string, 
    modulo: 'Clientes' | 'Produtos' | 'Orçamentos' | 'Feed' | 'Especialista IA' | 'Workspace' | 'Sistema' | string, 
    detalhe?: string,
    tipoAcao: 'criacao' | 'edicao' | 'exclusao' | 'outros' = 'outros',
    usuarioRole?: UserRole
  ): void {
    const all = getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    all.unshift({
      id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      workspace_id: workspaceId,
      usuario_nome: usuarioNome,
      usuario_role: usuarioRole,
      acao,
      tipo_acao: tipoAcao,
      modulo,
      data: new Date().toISOString(),
      ip_ou_detalhe: detalhe,
    });
    setItem(STORAGE_KEYS.AUDIT_LOGS, all);
  }

  // Notifications System
  static getNotifications(workspaceId: string, currentUser?: User | null): NotificationItem[] {
    const all = getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    let list = all.filter(n => n.workspace_id === workspaceId);

    if (currentUser) {
      list = list.filter(n => {
        if (n.target_user_id && n.target_user_id !== currentUser.id) return false;
        if (n.target_roles && n.target_roles.length > 0 && !n.target_roles.includes(currentUser.role)) {
          return false;
        }
        return true;
      });
    }

    return list.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }

  static addNotification(item: Omit<NotificationItem, 'id' | 'data' | 'lida'>): NotificationItem {
    const all = getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const newNotif: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      lida: false,
      data: new Date().toISOString(),
    };
    all.unshift(newNotif);
    setItem(STORAGE_KEYS.NOTIFICATIONS, all);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartvisit_notification_created', { detail: newNotif }));
    }

    return newNotif;
  }

  static markNotificationAsRead(notifId: string): void {
    const all = getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const idx = all.findIndex(n => n.id === notifId);
    if (idx >= 0) {
      all[idx].lida = true;
      setItem(STORAGE_KEYS.NOTIFICATIONS, all);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('smartvisit_notifications_updated'));
      }
    }
  }

  static markAllNotificationsAsRead(workspaceId: string, currentUser?: User | null): void {
    const all = getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    all.forEach(n => {
      if (n.workspace_id === workspaceId) {
        if (!currentUser || !n.target_roles || n.target_roles.includes(currentUser.role)) {
          n.lida = true;
        }
      }
    });
    setItem(STORAGE_KEYS.NOTIFICATIONS, all);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartvisit_notifications_updated'));
    }
  }

  static clearNotifications(workspaceId: string): void {
    let all = getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    all = all.filter(n => n.workspace_id !== workspaceId);
    setItem(STORAGE_KEYS.NOTIFICATIONS, all);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartvisit_notifications_updated'));
    }
  }
}
