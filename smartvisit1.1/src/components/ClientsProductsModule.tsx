import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Package, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Download, 
  UploadCloud, 
  X, 
  Building2, 
  Tag,
  AlertTriangle,
  CheckCircle2, 
  FileSpreadsheet,
  Loader2,
  Clock,
  Check,
  RefreshCw,
  Database,
  Sparkles
} from 'lucide-react';
import { Cliente, Produto, User, ImportRecord } from '../types';
import { StorageService } from '../lib/storage';
import { formatCurrency, formatDateTime } from '../lib/pdfPngGenerator';
import { 
  downloadProdutosModelCSV, 
  downloadClientesModelCSV,
  importProdutosFromCSV,
  importClientesFromCSV
} from '../lib/csvExportImport';
import {
  supabase,
  getClientesFromSupabase,
  insertClienteToSupabase,
  deleteClienteFromSupabase,
  clearClientesFromSupabase,
  seedInitialClientesToSupabase,
  getProdutosFromSupabase,
  insertProdutoToSupabase,
  deleteProdutoFromSupabase,
  clearProdutosFromSupabase,
  seedInitialProdutosToSupabase,
} from '../lib/supabaseClient';

interface ClientsProductsModuleProps {
  currentUser: User;
  workspaceId: string;
  onNavigateToImports?: () => void;
}

export const ClientsProductsModule: React.FC<ClientsProductsModuleProps> = ({
  currentUser,
  workspaceId,
}) => {
  const [activeTab, setActiveTab] = useState<'produtos' | 'clientes'>('produtos');

  // Supabase Live Data State
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [isLoadingSupabase, setIsLoadingSupabase] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [isSavingCliente, setIsSavingCliente] = useState(false);

  const [isProdutoModalOpen, setIsProdutoModalOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [isSavingProduto, setIsSavingProduto] = useState(false);

  // Delete Modals state
  const [produtoToDelete, setProdutoToDelete] = useState<Produto | null>(null);
  const [isDeleteAllProdutosModalOpen, setIsDeleteAllProdutosModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const [isDeleteAllClientesModalOpen, setIsDeleteAllClientesModalOpen] = useState(false);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'produtos' | 'clientes'>('produtos');
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; text: string; details?: string[] } | null>(null);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportRecord[]>(() =>
    StorageService.getImports(workspaceId).filter((r) => r.tipo === 'produtos' || r.tipo === 'clientes')
  );

  // Form Fields - Cliente
  const [cliCodigo, setCliCodigo] = useState('');
  const [cliRazaoSocial, setCliRazaoSocial] = useState('');
  const [cliCnpj, setCliCnpj] = useState('');
  const [cliEndereco, setCliEndereco] = useState('');
  const [cliBairro, setCliBairro] = useState('');
  const [cliCidade, setCliCidade] = useState('');
  const [cliUf, setCliUf] = useState('');
  const [cliCep, setCliCep] = useState('');
  const [cliTelefone, setCliTelefone] = useState('');

  // Form Fields - Produto
  const [prodCodigo, setProdCodigo] = useState('');
  const [prodDescricao, setProdDescricao] = useState('');
  const [prodEmbalagem, setProdEmbalagem] = useState('UN');
  const [prodPrecoBase, setProdPrecoBase] = useState<number>(0);

  const userRole = (currentUser?.role || '').toLowerCase();
  const canManage = userRole === 'gerente' || userRole === 'diretor' || userRole === 'admin' || userRole === 'vendedor' || userRole === 'gestor';

  // DIRECT SELECT FROM SUPABASE
  const fetchSupabaseData = async (showLoader = true) => {
    if (showLoader) setIsLoadingSupabase(true);
    try {
      const [cliData, prodData] = await Promise.all([
        getClientesFromSupabase(workspaceId),
        getProdutosFromSupabase(workspaceId),
      ]);
      setClientes(cliData);
      setProdutos(prodData);
    } catch (err: any) {
      console.error('Erro ao buscar dados do Supabase:', err);
      setActionFeedback({
        type: 'error',
        text: `Erro ao conectar com o banco Supabase: ${err?.message || 'Falha de rede.'}`,
      });
    } finally {
      if (showLoader) setIsLoadingSupabase(false);
      setImportHistory(
        StorageService.getImports(workspaceId).filter((r) => r.tipo === 'produtos' || r.tipo === 'clientes')
      );
    }
  };

  // Seeding initial catalog into Supabase for this branch if empty
  const handleSeedInitialData = async () => {
    setIsSeeding(true);
    setActionFeedback(null);
    try {
      await Promise.all([
        seedInitialClientesToSupabase(workspaceId),
        seedInitialProdutosToSupabase(workspaceId),
      ]);
      await fetchSupabaseData(false);
      setActionFeedback({
        type: 'success',
        text: 'Carga inicial do catálogo sincronizada no Supabase com sucesso!',
      });
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: `Erro ao semear dados no Supabase: ${err?.message || 'Falha no banco.'}`,
      });
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    fetchSupabaseData(true);

    // Inscrição em tempo real via canais do Supabase (Realtime postgres_changes)
    const channel = supabase
      .channel(`realtime-clients-products-${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
        getClientesFromSupabase(workspaceId).then(setClientes);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, () => {
        getProdutosFromSupabase(workspaceId).then(setProdutos);
      })
      .subscribe();

    const handleSync = () => fetchSupabaseData(false);
    window.addEventListener('smartvisit_clientes_updated', handleSync);
    window.addEventListener('smartvisit_produtos_updated', handleSync);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('smartvisit_clientes_updated', handleSync);
      window.removeEventListener('smartvisit_produtos_updated', handleSync);
    };
  }, [workspaceId]);

  // CSV IMPORT HANDLER
  const handleRunImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImportFile) return;

    setIsProcessingImport(true);
    setImportFeedback(null);

    try {
      let record: ImportRecord;
      if (importType === 'produtos') {
        record = await importProdutosFromCSV(selectedImportFile, workspaceId, currentUser.nome);
      } else {
        record = await importClientesFromCSV(selectedImportFile, workspaceId, currentUser.nome);
      }

      if (record.status === 'sucesso' || record.status === 'sucesso_parcial') {
        setImportFeedback({
          type: 'success',
          text: `Importação concluída! ${record.total_registros} ${
            importType === 'produtos' ? 'produto(s)' : 'cliente(s)'
          } inserido(s) e sincronizado(s) no Supabase com sucesso.`,
          details: record.mensagens_erro.length > 0 ? record.mensagens_erro : undefined,
        });
      } else {
        setImportFeedback({
          type: 'error',
          text: `Falha na importação. Encontrado(s) ${record.erros_qtd} erro(s).`,
          details: record.mensagens_erro,
        });
      }

      setSelectedImportFile(null);
      await fetchSupabaseData(false);
    } catch (err: any) {
      setImportFeedback({
        type: 'error',
        text: `Erro ao importar arquivo: ${err?.message || 'Arquivo inválido.'}`,
      });
    } finally {
      setIsProcessingImport(false);
    }
  };

  // CLIENTE HANDLERS
  const handleOpenClienteModal = (c?: Cliente) => {
    if (c) {
      setEditingCliente(c);
      setCliCodigo(c.codigo);
      setCliRazaoSocial(c.razao_social);
      setCliCnpj(c.cnpj || c.cpf_cnpj || '');
      setCliEndereco(c.endereco || '');
      setCliBairro(c.bairro || '');
      setCliCidade(c.cidade || '');
      setCliUf(c.uf || '');
      setCliCep(c.cep || '');
      setCliTelefone(c.telefone || '');
    } else {
      setEditingCliente(null);
      setCliCodigo(`CLI${String(clientes.length + 1).padStart(3, '0')}`);
      setCliRazaoSocial('');
      setCliCnpj('');
      setCliEndereco('');
      setCliBairro('');
      setCliCidade('');
      setCliUf('SP');
      setCliCep('');
      setCliTelefone('');
    }
    setIsClienteModalOpen(true);
  };

  // DIRECT INSERT / UPDATE CLIENTE TO SUPABASE
  const handleSaveCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliCodigo.trim() || !cliRazaoSocial.trim()) return;

    setIsSavingCliente(true);
    setActionFeedback(null);

    const clientToSave: Cliente = {
      id: editingCliente ? editingCliente.id : `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workspace_id: workspaceId,
      filialId: workspaceId,
      codigo: cliCodigo.trim().toUpperCase(),
      razao_social: cliRazaoSocial.trim(),
      cnpj: cliCnpj.trim() || undefined,
      cpf_cnpj: cliCnpj.trim() || undefined,
      endereco: cliEndereco.trim(),
      bairro: cliBairro.trim(),
      cidade: cliCidade.trim(),
      uf: cliUf.trim().toUpperCase(),
      cep: cliCep.trim(),
      telefone: cliTelefone.trim(),
    };

    try {
      // 1. Chamada direta ao cliente do Supabase (@supabase/supabase-js)
      const saved = await insertClienteToSupabase(clientToSave);

      // 2. Atualização direta do estado em tempo real
      setClientes(prev => {
        const idx = prev.findIndex(c => c.id === saved.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [saved, ...prev];
      });

      // 3. Atualização do cache local
      StorageService.saveCliente(saved);
      StorageService.logAudit(
        workspaceId,
        currentUser.nome,
        `${editingCliente ? 'Atualizou' : 'Cadastrou'} cliente ${saved.codigo} (${saved.razao_social})`,
        'Clientes',
        `Cidade/UF: ${saved.cidade}/${saved.uf} | Tel: ${saved.telefone}`,
        editingCliente ? 'edicao' : 'criacao',
        currentUser.role
      );

      setActionFeedback({
        type: 'success',
        text: `Cliente "${saved.razao_social}" salvo e sincronizado no Supabase com sucesso!`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
      setIsClienteModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao salvar cliente no Supabase:', err);
      setActionFeedback({
        type: 'error',
        text: `Erro ao salvar cliente no Supabase: ${err?.message || 'Falha na requisição.'}`,
      });
    } finally {
      setIsSavingCliente(false);
    }
  };

  // DIRECT DELETE SINGLE CLIENTE FROM SUPABASE
  const confirmDeleteSingleCliente = async () => {
    if (!clienteToDelete) return;
    setIsDeleting(true);
    try {
      await deleteClienteFromSupabase(clienteToDelete.id);
      setClientes(prev => prev.filter(c => c.id !== clienteToDelete.id));
      StorageService.deleteCliente(clienteToDelete.id);
      StorageService.logAudit(
        workspaceId, 
        currentUser.nome, 
        `Excluiu cliente ${clienteToDelete.codigo}`, 
        'Clientes',
        `Razão Social: ${clienteToDelete.razao_social}`,
        'exclusao',
        currentUser.role
      );
      setActionFeedback({
        type: 'success',
        text: `Cliente "${clienteToDelete.razao_social}" removido do Supabase!`,
      });
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: any) {
      console.error('Erro ao excluir cliente no Supabase:', err);
      setActionFeedback({
        type: 'error',
        text: `Erro ao deletar cliente no Supabase: ${err?.message || 'Falha na exclusão.'}`,
      });
    } finally {
      setIsDeleting(false);
      setClienteToDelete(null);
    }
  };

  // DIRECT CLEAR ALL CLIENTES FROM SUPABASE
  const confirmDeleteAllClientes = async () => {
    const count = clientes.length;
    setIsDeleting(true);
    try {
      await clearClientesFromSupabase(workspaceId);
      setClientes([]);
      StorageService.clearAllClientes(workspaceId);
      StorageService.logAudit(
        workspaceId,
        currentUser.nome,
        `Excluiu TODOS os clientes do cadastro (${count} itens)`,
        'Clientes',
        `Lote de ${count} clientes removido por completo do workspace`,
        'exclusao',
        currentUser.role
      );
      setActionFeedback({
        type: 'success',
        text: `Todos os ${count} clientes foram removidos do Supabase com sucesso.`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error('Erro ao limpar clientes no Supabase:', err);
      setActionFeedback({
        type: 'error',
        text: `Erro ao limpar clientes no Supabase: ${err?.message || 'Falha no banco.'}`,
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteAllClientesModalOpen(false);
    }
  };

  // PRODUTO HANDLERS
  const handleOpenProdutoModal = (p?: Produto) => {
    if (p) {
      setEditingProduto(p);
      setProdCodigo(p.codigo);
      setProdDescricao(p.descricao);
      setProdEmbalagem(p.embalagem || 'UN');
      setProdPrecoBase(p.preco_base);
    } else {
      setEditingProduto(null);
      setProdCodigo(`P${String(produtos.length + 1001)}`);
      setProdDescricao('');
      setProdEmbalagem('UN');
      setProdPrecoBase(0);
    }
    setIsProdutoModalOpen(true);
  };

  // DIRECT INSERT / UPDATE PRODUTO TO SUPABASE
  const handleSaveProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodCodigo.trim() || !prodDescricao.trim()) return;

    setIsSavingProduto(true);
    setActionFeedback(null);

    const productToSave: Produto = {
      id: editingProduto ? editingProduto.id : `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workspace_id: workspaceId,
      filialId: workspaceId,
      codigo: prodCodigo.trim().toUpperCase(),
      descricao: prodDescricao.trim(),
      embalagem: prodEmbalagem.trim().toUpperCase() || 'UN',
      preco_base: Number(prodPrecoBase) >= 0 ? Number(prodPrecoBase) : 0,
    };

    try {
      // 1. Chamada direta ao cliente do Supabase (@supabase/supabase-js)
      const saved = await insertProdutoToSupabase(productToSave);

      // 2. Atualização direta do estado em tempo real
      setProdutos(prev => {
        const idx = prev.findIndex(p => p.id === saved.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [saved, ...prev];
      });

      // 3. Atualização do cache local
      StorageService.saveProduto(saved);
      StorageService.logAudit(
        workspaceId,
        currentUser.nome,
        `${editingProduto ? 'Atualizou' : 'Cadastrou'} produto ${saved.codigo} (${saved.descricao})`,
        'Produtos',
        `Emb: ${saved.embalagem} | Preço Base: R$ ${saved.preco_base.toFixed(2)}`,
        editingProduto ? 'edicao' : 'criacao',
        currentUser.role
      );

      setActionFeedback({
        type: 'success',
        text: `Produto "${saved.codigo}" salvo e sincronizado no Supabase com sucesso!`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
      setIsProdutoModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao salvar produto no Supabase:', err);
      setActionFeedback({
        type: 'error',
        text: `Erro ao salvar produto no Supabase: ${err?.message || 'Falha na requisição.'}`,
      });
    } finally {
      setIsSavingProduto(false);
    }
  };

  // DIRECT DELETE SINGLE PRODUTO FROM SUPABASE
  const confirmDeleteSingleProduto = async () => {
    if (!produtoToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProdutoFromSupabase(produtoToDelete.id);
      setProdutos(prev => prev.filter(p => p.id !== produtoToDelete.id));
      StorageService.deleteProduto(produtoToDelete.id);
      StorageService.logAudit(
        workspaceId, 
        currentUser.nome, 
        `Excluiu produto ${produtoToDelete.codigo}`, 
        'Produtos',
        `Descrição: ${produtoToDelete.descricao}`,
        'exclusao',
        currentUser.role
      );
      setActionFeedback({
        type: 'success',
        text: `Produto "${produtoToDelete.codigo}" removido do Supabase!`,
      });
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: any) {
      console.error('Erro ao deletar produto no Supabase:', err);
      setActionFeedback({
        type: 'error',
        text: `Erro ao excluir produto no Supabase: ${err?.message || 'Falha na exclusão.'}`,
      });
    } finally {
      setIsDeleting(false);
      setProdutoToDelete(null);
    }
  };

  // DIRECT CLEAR ALL PRODUTOS FROM SUPABASE
  const confirmDeleteAllProdutos = async () => {
    const count = produtos.length;
    setIsDeleting(true);
    try {
      await clearProdutosFromSupabase(workspaceId);
      setProdutos([]);
      StorageService.clearAllProdutos(workspaceId);
      StorageService.logAudit(
        workspaceId,
        currentUser.nome,
        `Excluiu TODOS os produtos do catálogo (${count} itens)`,
        'Produtos',
        `Lote de ${count} produtos removido por completo do workspace`,
        'exclusao',
        currentUser.role
      );
      setActionFeedback({
        type: 'success',
        text: `Todos os ${count} produtos foram removidos do Supabase com sucesso.`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error('Erro ao limpar produtos no Supabase:', err);
      setActionFeedback({
        type: 'error',
        text: `Erro ao limpar produtos no Supabase: ${err?.message || 'Falha no banco.'}`,
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteAllProdutosModalOpen(false);
    }
  };

  // Filtered lists for instant search
  const filteredClientes = clientes.filter(
    c =>
      c.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.razao_social.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.cidade || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProdutos = produtos.filter(
    p =>
      p.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.descricao.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Realtime Supabase Status & Feedback Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-xs text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-slate-700">Supabase em Tempo Real:</span>
          <span className="text-slate-500 font-mono">
            {isLoadingSupabase ? 'Carregando tabelas...' : `${clientes.length} clientes, ${produtos.length} produtos`}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {clientes.length === 0 && produtos.length === 0 && !isLoadingSupabase && (
            <button
              onClick={handleSeedInitialData}
              disabled={isSeeding}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Carregar catálogo inicial de exemplo direto no banco Supabase"
            >
              {isSeeding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Carga Inicial no Supabase</span>
            </button>
          )}

          <button
            onClick={() => fetchSupabaseData(true)}
            disabled={isLoadingSupabase}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            title="Fazer novo SELECT no Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLoadingSupabase ? 'animate-spin' : ''}`} />
            <span>Atualizar Banco</span>
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold animate-in fade-in duration-200 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{actionFeedback.text}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Tabs */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('produtos')}
              className={`px-4 py-2 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
                activeTab === 'produtos'
                  ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Produtos ({produtos.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('clientes')}
              className={`px-4 py-2 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
                activeTab === 'clientes'
                  ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Clientes ({clientes.length})</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Catálogo comercial sincronizado diretamente com o Supabase em tempo real.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {canManage && activeTab === 'produtos' && produtos.length > 0 && (
            <button
              onClick={() => setIsDeleteAllProdutosModalOpen(true)}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200/80 transition-all flex items-center gap-1.5"
              title="Excluir todos os produtos do catálogo"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Excluir Todos ({produtos.length})</span>
            </button>
          )}

          {canManage && activeTab === 'clientes' && clientes.length > 0 && (
            <button
              onClick={() => setIsDeleteAllClientesModalOpen(true)}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200/80 transition-all flex items-center gap-1.5"
              title="Excluir todos os clientes cadastrados"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Excluir Todos ({clientes.length})</span>
            </button>
          )}

          {canManage && (
            <button
              onClick={() => {
                setImportType(activeTab);
                setSelectedImportFile(null);
                setImportFeedback(null);
                setIsImportModalOpen(true);
              }}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition-all flex items-center gap-1.5"
              title={`Importar ${activeTab === 'produtos' ? 'produtos' : 'clientes'} via planilha CSV ou Excel`}
            >
              <UploadCloud className="w-4 h-4 text-blue-700" />
              <span>Importar Planilha</span>
            </button>
          )}

          {canManage && (
            <button
              onClick={() => (activeTab === 'produtos' ? handleOpenProdutoModal() : handleOpenClienteModal())}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-700/20 transition-all flex items-center gap-1.5 ml-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{activeTab === 'produtos' ? 'Novo Produto' : 'Novo Cliente'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            activeTab === 'produtos'
              ? 'Pesquisar produto por código ou descrição...'
              : 'Pesquisar cliente por código, razão social ou cidade...'
          }
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium shadow-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
        />
      </div>

      {/* Loading Skeleton */}
      {isLoadingSupabase ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-bold text-slate-700">Carregando dados do Supabase...</p>
          <p className="text-xs text-slate-400">Efetuando consulta SELECT na tabela de {activeTab}...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: PRODUTOS */}
          {activeTab === 'produtos' && (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-3 w-28">CÓDIGO</th>
                      <th className="p-3">DESCRIÇÃO DO PRODUTO</th>
                      <th className="p-3 text-center w-24">EMBALAGEM</th>
                      <th className="p-3 text-right w-36">PREÇO BASE</th>
                      {canManage && <th className="p-3 text-center w-20">AÇÕES</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProdutos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                          <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p>Nenhum produto cadastrado no banco Supabase para este workspace.</p>
                          {canManage && (
                            <div className="mt-3 flex items-center justify-center gap-2">
                              <button
                                onClick={handleSeedInitialData}
                                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg border border-blue-200"
                              >
                                Carregar Produtos Iniciais Padrão
                              </button>
                              <button
                                onClick={() => handleOpenProdutoModal()}
                                className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 font-bold rounded-lg"
                              >
                                Cadastrar Primeiro Produto
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredProdutos.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-extrabold text-blue-900">{p.codigo}</td>
                          <td className="p-3 font-bold text-slate-900">{p.descricao}</td>
                          <td className="p-3 text-center">
                            <span className="bg-blue-100 text-blue-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border border-blue-200">
                              {p.embalagem}
                            </span>
                          </td>
                          <td className="p-3 text-right font-black text-slate-900 text-sm">
                            {formatCurrency(p.preco_base)}
                          </td>
                          {canManage && (
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenProdutoModal(p)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                  title="Editar Produto"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setProdutoToDelete(p)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                                  title="Excluir Produto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CLIENTES */}
          {activeTab === 'clientes' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClientes.length === 0 ? (
                <div className="col-span-full bg-white p-12 rounded-2xl text-center text-slate-500 border border-slate-200 space-y-3">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>Nenhum cliente cadastrado no banco Supabase para este workspace.</p>
                  {canManage && (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={handleSeedInitialData}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs rounded-lg border border-blue-200"
                      >
                        Carregar Clientes Iniciais Padrão
                      </button>
                      <button
                        onClick={() => handleOpenClienteModal()}
                        className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs rounded-lg"
                      >
                        Cadastrar Primeiro Cliente
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredClientes.map((c) => (
                  <div key={c.id} className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 space-y-3 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="bg-blue-100 text-blue-900 text-xs font-black px-2.5 py-0.5 rounded-full">
                        {c.codigo}
                      </span>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenClienteModal(c)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setClienteToDelete(c)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 line-clamp-1">{c.razao_social}</h4>
                      {c.cnpj && (
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">CNPJ: {c.cnpj}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {c.endereco} - {c.bairro}
                      </p>
                      <p className="text-xs font-semibold text-slate-700">
                        {c.cidade}/{c.uf} - CEP: {c.cep}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-0.5">
                      <div><strong>Tel:</strong> {c.telefone || 'Não informado'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL PRODUTO */}
      {isProdutoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {editingProduto ? 'Editar Produto' : 'Novo Produto'}
                </h3>
                <span className="text-[11px] text-blue-600 font-semibold">Sincronização Direta no Supabase</span>
              </div>
              <button onClick={() => setIsProdutoModalOpen(false)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduto} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Código do Produto
                </label>
                <input
                  type="text"
                  value={prodCodigo}
                  onChange={(e) => setProdCodigo(e.target.value)}
                  placeholder="Ex: P1001"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={prodDescricao}
                  onChange={(e) => setProdDescricao(e.target.value)}
                  placeholder="Nome/Descrição do produto"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Embalagem
                  </label>
                  <input
                    type="text"
                    value={prodEmbalagem}
                    onChange={(e) => setProdEmbalagem(e.target.value)}
                    placeholder="Ex: UN, CX, RL"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Preço Base (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodPrecoBase}
                    onChange={(e) => setProdPrecoBase(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-right"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsProdutoModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduto}
                  className="px-5 py-2 bg-blue-700 text-white rounded-xl text-xs font-bold hover:bg-blue-800 cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {isSavingProduto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isSavingProduto ? 'Gravando no Supabase...' : 'Salvar no Supabase'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CLIENTE */}
      {isClienteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
                </h3>
                <span className="text-[11px] text-blue-600 font-semibold">Sincronização Direta no Supabase</span>
              </div>
              <button onClick={() => setIsClienteModalOpen(false)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCliente} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    value={cliCodigo}
                    onChange={(e) => setCliCodigo(e.target.value)}
                    placeholder="CLI001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Razão Social
                  </label>
                  <input
                    type="text"
                    value={cliRazaoSocial}
                    onChange={(e) => setCliRazaoSocial(e.target.value)}
                    placeholder="Nome da empresa cliente"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  CNPJ / CPF
                </label>
                <input
                  type="text"
                  value={cliCnpj}
                  onChange={(e) => setCliCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  value={cliEndereco}
                  onChange={(e) => setCliEndereco(e.target.value)}
                  placeholder="Rua / Av. e número"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={cliBairro}
                    onChange={(e) => setCliBairro(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Cidade / UF
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={cliCidade}
                      onChange={(e) => setCliCidade(e.target.value)}
                      placeholder="Cidade"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                    <input
                      type="text"
                      value={cliUf}
                      onChange={(e) => setCliUf(e.target.value)}
                      placeholder="UF"
                      className="w-14 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    CEP
                  </label>
                  <input
                    type="text"
                    value={cliCep}
                    onChange={(e) => setCliCep(e.target.value)}
                    placeholder="00000-000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={cliTelefone}
                    onChange={(e) => setCliTelefone(e.target.value)}
                    placeholder="(00) 0000-0000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsClienteModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCliente}
                  className="px-5 py-2 bg-blue-700 text-white rounded-xl text-xs font-bold hover:bg-blue-800 cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {isSavingCliente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isSavingCliente ? 'Gravando no Supabase...' : 'Salvar Cliente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR SINGLE PRODUTO */}
      {produtoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full text-red-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir Produto</h3>
                <p className="text-xs text-slate-500">Código: {produtoToDelete.codigo}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <p className="text-xs font-bold text-slate-900">{produtoToDelete.descricao}</p>
              <p className="text-[11px] text-slate-500">Embalagem: {produtoToDelete.embalagem} | Preço Base: {formatCurrency(produtoToDelete.preco_base)}</p>
            </div>

            <p className="text-xs text-slate-600">
              Tem certeza que deseja remover este produto do banco Supabase? Esta ação não poderá ser desfeita.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProdutoToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingleProduto}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Excluir do Supabase</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR TODOS OS PRODUTOS */}
      {isDeleteAllProdutosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-red-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir TODOS os Produtos</h3>
                <p className="text-xs text-red-600 font-semibold">Ação no Banco Supabase</p>
              </div>
            </div>

            <div className="bg-red-50 p-3.5 rounded-xl border border-red-200 text-xs text-red-800 space-y-1">
              <p className="font-bold">Atenção!</p>
              <p>Você está prestes a apagar <strong>todos os {produtos.length} produtos</strong> desta filial no banco Supabase.</p>
              <p className="text-[11px] text-red-700 mt-1">Essa operação é irreversível no banco de dados.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteAllProdutosModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAllProdutos}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Sim, Limpar Tabela no Supabase</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR SINGLE CLIENTE */}
      {clienteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full text-red-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir Cliente</h3>
                <p className="text-xs text-slate-500">Código: {clienteToDelete.codigo}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <p className="text-xs font-bold text-slate-900">{clienteToDelete.razao_social}</p>
              <p className="text-[11px] text-slate-500">{clienteToDelete.cidade}/{clienteToDelete.uf} - Tel: {clienteToDelete.telefone}</p>
            </div>

            <p className="text-xs text-slate-600">
              Tem certeza que deseja remover este cliente do banco Supabase? Esta ação não poderá ser desfeita.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setClienteToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingleCliente}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Excluir do Supabase</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR TODOS OS CLIENTES */}
      {isDeleteAllClientesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-red-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir TODOS os Clientes</h3>
                <p className="text-xs text-red-600 font-semibold">Ação no Banco Supabase</p>
              </div>
            </div>

            <div className="bg-red-50 p-3.5 rounded-xl border border-red-200 text-xs text-red-800 space-y-1">
              <p className="font-bold">Atenção!</p>
              <p>Você está prestes a apagar <strong>todos os {clientes.length} clientes</strong> desta filial no banco Supabase.</p>
              <p className="text-[11px] text-red-700 mt-1">Essa operação é irreversível no banco de dados.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteAllClientesModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAllClientes}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Sim, Limpar Clientes no Supabase</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPORTAÇÃO DE PRODUTOS E CLIENTES */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Importação de {importType === 'produtos' ? 'Produtos' : 'Clientes'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gera inserções em lote diretamente nas tabelas correspondentes do Supabase
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type selector */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setImportType('produtos');
                  setSelectedImportFile(null);
                  setImportFeedback(null);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  importType === 'produtos'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Importar Produtos ({produtos.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setImportType('clientes');
                  setSelectedImportFile(null);
                  setImportFeedback(null);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  importType === 'clientes'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Importar Clientes ({clientes.length})</span>
              </button>
            </div>

            {/* Instructions & Template download */}
            <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 text-xs text-blue-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                  <span>Modelo de Planilha Padrão (CSV / Excel)</span>
                </p>
                <p className="text-[11px] text-blue-700">
                  {importType === 'produtos'
                    ? 'Colunas: Codigo, Descricao, Embalagem, PrecoBase.'
                    : 'Colunas: Codigo, RazaoSocial, Endereco, Bairro, Cidade, UF, CEP, Telefone, CNPJ.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (importType === 'produtos') {
                    downloadProdutosModelCSV();
                  } else {
                    downloadClientesModelCSV();
                  }
                }}
                className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Modelo CSV</span>
              </button>
            </div>

            {/* Upload Area */}
            <form onSubmit={handleRunImport} className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center transition-all bg-slate-50/50">
                <input
                  type="file"
                  id="importFileInput"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedImportFile(e.target.files[0]);
                      setImportFeedback(null);
                    }
                  }}
                />
                <label
                  htmlFor="importFileInput"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800">
                      {selectedImportFile ? selectedImportFile.name : 'Clique para selecionar a planilha'}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Arquivos .CSV separados por vírgula ou ponto-e-vírgula
                    </p>
                  </div>
                </label>
              </div>

              {/* Feedback messages */}
              {importFeedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    importFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {importFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                    <span>{importFeedback.text}</span>
                  </div>
                  {importFeedback.details && (
                    <ul className="list-disc pl-5 text-[11px] opacity-90 space-y-0.5">
                      {importFeedback.details.slice(0, 5).map((msg, i) => (
                        <li key={i}>{msg}</li>
                      ))}
                      {importFeedback.details.length > 5 && (
                        <li>... e mais {importFeedback.details.length - 5} aviso(s).</li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportHistory(!showImportHistory)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{showImportHistory ? 'Ocultar Histórico' : 'Ver Histórico'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedImportFile || isProcessingImport}
                    className="px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    {isProcessingImport ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sincronizando no Supabase...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Processar e Inserir no Supabase</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* History Table */}
            {showImportHistory && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <h4 className="text-xs font-bold text-slate-800">Histórico de Importações</h4>
                <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 text-slate-600 font-bold">
                      <tr>
                        <th className="p-2">Data</th>
                        <th className="p-2">Arquivo</th>
                        <th className="p-2">Tipo</th>
                        <th className="p-2 text-center">Qtd</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {importHistory.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-3 text-center text-slate-400">
                            Nenhuma importação realizada neste workspace.
                          </td>
                        </tr>
                      ) : (
                        importHistory.map((rec) => (
                          <tr key={rec.id}>
                            <td className="p-2">{formatDateTime(rec.data)}</td>
                            <td className="p-2 font-medium truncate max-w-[140px]">{rec.arquivo_nome}</td>
                            <td className="p-2 uppercase font-mono text-[10px]">{rec.tipo}</td>
                            <td className="p-2 text-center font-bold">{rec.total_registros}</td>
                            <td className="p-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  rec.status === 'sucesso'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : rec.status === 'sucesso_parcial'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
