import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Building2, 
  Plus, 
  Users, 
  FileText, 
  TrendingUp, 
  ChevronRight, 
  CheckCircle2, 
  X,
  Check,
  Edit2,
  Layers,
  Trash2,
  AlertTriangle,
  Edit3,
  UserCheck
} from 'lucide-react';
import { User, Workspace } from '../types';
import { StorageService } from '../lib/storage';
import { formatCurrency, formatDateTime } from '../lib/pdfPngGenerator';

interface DiretorPanelProps {
  currentUser: User;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  onSelectWorkspace: (wsId: string) => void;
  onRefreshWorkspaces: () => void;
}

export const DiretorPanel: React.FC<DiretorPanelProps> = ({
  currentUser,
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onRefreshWorkspaces,
}) => {
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsGerenteName, setNewWsGerenteName] = useState('');
  const [newWsGerenteLogin, setNewWsGerenteLogin] = useState('');
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  // Edit Workspace Modal States
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editWsName, setEditWsName] = useState('');
  const [editWsCnpj, setEditWsCnpj] = useState('');
  const [editGerenteName, setEditGerenteName] = useState('');
  const [editGerenteLogin, setEditGerenteLogin] = useState('');
  const [editGerenteSenha, setEditGerenteSenha] = useState('');

  // Empresa Emitente fields for branch
  const [editEmpRazaoSocial, setEditEmpRazaoSocial] = useState('');
  const [editEmpCnpj, setEditEmpCnpj] = useState('');
  const [editEmpInscricaoEstadual, setEditEmpInscricaoEstadual] = useState('');
  const [editEmpEndereco, setEditEmpEndereco] = useState('');
  const [editEmpBairro, setEditEmpBairro] = useState('');
  const [editEmpCidade, setEditEmpCidade] = useState('');
  const [editEmpUf, setEditEmpUf] = useState('SP');
  const [editEmpCep, setEditEmpCep] = useState('');
  const [editEmpTelefone, setEditEmpTelefone] = useState('');

  // Quick inline rename state
  const [inlineEditingWsId, setInlineEditingWsId] = useState<string | null>(null);
  const [inlineWsName, setInlineWsName] = useState('');

  const handleStartInlineEdit = (ws: Workspace) => {
    setInlineEditingWsId(ws.id);
    setInlineWsName(ws.nome);
  };

  const handleSaveInlineName = (ws: Workspace) => {
    const cleanName = inlineWsName.trim();
    if (!cleanName || cleanName === ws.nome) {
      setInlineEditingWsId(null);
      return;
    }
    const updatedWs = { ...ws, nome: cleanName };
    StorageService.saveWorkspace(updatedWs);
    StorageService.logAudit(
      ws.id,
      currentUser.nome,
      `Renomeou filial de "${ws.nome}" para "${cleanName}"`,
      'Painel Diretor',
      `Nome da filial atualizado pelo Diretor ${currentUser.nome}`,
      'edicao',
      currentUser.role
    );
    setInlineEditingWsId(null);
    onRefreshWorkspaces();
    window.dispatchEvent(new Event('smartvisit_workspaces_updated'));
  };

  const handleOpenEditWorkspaceModal = (ws: Workspace) => {
    setEditingWorkspace(ws);
    setEditWsName(ws.nome);
    setEditWsCnpj(ws.cnpj || '00.000.000/0001-00');

    // Find manager user for this workspace across all users
    const allUsers = StorageService.getUsers();
    const wsUsers = StorageService.getUsers(ws.id);
    const gerenteUser = wsUsers.find(u => (u.workspace_id === ws.id || u.filialId === ws.id) && (u.role === 'gestor' || u.role === 'gerente')) 
      || allUsers.find(u => u.id === ws.gerente_id)
      || wsUsers.find(u => u.id === ws.gerente_id);

    setEditGerenteName(gerenteUser?.nome || ws.gerente_nome || 'Gerente Responsável');
    setEditGerenteLogin(gerenteUser?.login || `gerente.${ws.id.replace(/[^a-zA-Z0-9]/g, '')}`);
    setEditGerenteSenha('');

    // Find empresa emitente for this workspace
    const emp = StorageService.getEmpresaEmitente(ws.id);
    setEditEmpRazaoSocial(emp.razao_social || `${ws.nome} LTDA`);
    setEditEmpCnpj(emp.cnpj || ws.cnpj || '00.000.000/0001-00');
    setEditEmpInscricaoEstadual(emp.inscricao_estadual || 'ISENTO');
    setEditEmpEndereco(emp.endereco || 'Rua Comercial, 100');
    setEditEmpBairro(emp.bairro || 'Centro');
    setEditEmpCidade(emp.municipio || 'São Paulo');
    setEditEmpUf(emp.uf || 'SP');
    setEditEmpCep(emp.cep || '01000-000');
    setEditEmpTelefone(emp.telefone || '(11) 3000-0000');
  };

  const handleSaveWorkspaceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspace) return;

    const wsId = editingWorkspace.id;

    // 1. Find existing manager user
    const allUsers = StorageService.getUsers();
    const wsUsers = StorageService.getUsers(wsId);
    let gerenteUser = wsUsers.find(u => (u.workspace_id === wsId || u.filialId === wsId) && (u.role === 'gestor' || u.role === 'gerente')) 
      || allUsers.find(u => u.id === editingWorkspace.gerente_id)
      || wsUsers.find(u => u.id === editingWorkspace.gerente_id);

    const targetGerenteName = editGerenteName.trim() || editingWorkspace.gerente_nome || 'Gerente Responsável';
    const rawLogin = editGerenteLogin.trim().toLowerCase().replace(/^@/, '');
    const targetGerenteLogin = rawLogin || (gerenteUser ? gerenteUser.login : `gerente.${wsId.replace(/[^a-zA-Z0-9]/g, '')}`);

    // Only validate duplicate login if the user changed the login to a new value
    if (targetGerenteLogin && (!gerenteUser || targetGerenteLogin !== gerenteUser.login.toLowerCase().replace(/^@/, ''))) {
      if (StorageService.isDuplicateUserLogin(targetGerenteLogin, gerenteUser?.id)) {
        alert(`Atenção: O login "${targetGerenteLogin}" já está sendo usado por outro usuário. Por favor, escolha um login diferente para o gerente.`);
        return;
      }
    }

    if (gerenteUser) {
      gerenteUser = {
        ...gerenteUser,
        workspace_id: wsId,
        filialId: wsId,
        nome: targetGerenteName,
        login: targetGerenteLogin,
        senha: editGerenteSenha.trim() ? editGerenteSenha.trim() : gerenteUser.senha,
      };
      StorageService.saveUser(gerenteUser);
    } else {
      const newGerenteId = `usr-gerente-${Date.now()}`;
      const newGerente: User = {
        id: newGerenteId,
        workspace_id: wsId,
        filialId: wsId,
        nome: targetGerenteName,
        login: targetGerenteLogin,
        senha: editGerenteSenha.trim() || '123',
        role: 'gestor',
        setor: 'Gerência Comercial',
        created_at: new Date().toISOString(),
      };
      StorageService.saveUser(newGerente);
      gerenteUser = newGerente;
    }

    // 2. Update Workspace
    const updatedWs: Workspace = {
      ...editingWorkspace,
      nome: editWsName.trim() || editingWorkspace.nome,
      cnpj: editWsCnpj.trim() || editingWorkspace.cnpj || '00.000.000/0001-00',
      gerente_id: gerenteUser.id,
      gerente_nome: targetGerenteName,
    };
    StorageService.saveWorkspace(updatedWs);

    // 3. Update Empresa Emitente
    const updatedEmpresa = {
      workspace_id: wsId,
      razao_social: editEmpRazaoSocial.trim() || `${updatedWs.nome} LTDA`,
      cnpj: editEmpCnpj.trim() || updatedWs.cnpj || '00.000.000/0001-00',
      inscricao_estadual: editEmpInscricaoEstadual.trim() || 'ISENTO',
      endereco: editEmpEndereco.trim() || 'Rua Comercial, 100',
      bairro: editEmpBairro.trim() || 'Centro',
      municipio: editEmpCidade.trim() || 'São Paulo',
      uf: editEmpUf.trim() || 'SP',
      cep: editEmpCep.trim() || '01000-000',
      telefone: editEmpTelefone.trim() || '(11) 3000-0000',
    };
    StorageService.saveEmpresaEmitente(updatedEmpresa);

    // 4. Audit Log
    StorageService.logAudit(
      wsId,
      currentUser.nome,
      `Atualizou dados da filial "${updatedWs.nome}" e gerente "${targetGerenteName}"`,
      'Painel Diretor',
      `Filial e gerente atualizados pelo Diretor ${currentUser.nome}`,
      'edicao',
      currentUser.role
    );

    setEditingWorkspace(null);
    onRefreshWorkspaces();
    window.dispatchEvent(new Event('smartvisit_workspaces_updated'));
  };

  const handleDeleteWorkspaceClick = (ws: Workspace) => {
    if (workspaces.length <= 1) {
      alert('Atenção: É necessário manter pelo menos uma filial cadastrada no sistema.');
      return;
    }
    setWorkspaceToDelete(ws);
  };

  const handleConfirmDeleteWorkspace = () => {
    if (!workspaceToDelete) return;
    const wsId = workspaceToDelete.id;
    const wsName = workspaceToDelete.nome;

    if (wsId === activeWorkspace.id) {
      const remaining = workspaces.filter(w => w.id !== wsId);
      if (remaining.length > 0) {
        onSelectWorkspace(remaining[0].id);
      }
    }

    StorageService.deleteWorkspace(wsId);
    StorageService.logAudit(
      activeWorkspace.id,
      currentUser.nome,
      `Excluiu a filial/workspace "${wsName}" (${wsId})`,
      'Painel Diretor',
      `Filial removida por ${currentUser.nome}`,
      'exclusao',
      currentUser.role
    );

    setWorkspaceToDelete(null);
    onRefreshWorkspaces();
  };

  // Calculate Global Metrics
  let globalQuotationTotal = 0;
  let globalQuotationCount = 0;

  workspaces.forEach((ws) => {
    const quotes = StorageService.getQuotations(ws.id, currentUser);
    globalQuotationCount += quotes.length;
    quotes.forEach((q) => {
      globalQuotationTotal += q.valor_total;
    });
  });

  const allAuditLogs = StorageService.getAllGlobalAuditLogs();

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim() || !newWsGerenteLogin.trim()) return;

    const targetName = newWsGerenteName.trim() || 'Gerente Responsável';
    const targetLogin = newWsGerenteLogin.trim().toLowerCase();

    if (StorageService.isDuplicateUserName(targetName)) {
      alert(`Atenção: Este usuário já existe com o nome "${targetName}". Por favor, altere o nome.`);
      return;
    }

    if (StorageService.isDuplicateUserLogin(targetLogin)) {
      alert(`Atenção: Este usuário já existe com o login "${targetLogin}". Por favor, altere o login.`);
      return;
    }

    const wsId = `ws-${Date.now()}`;
    const gerenteId = `usr-gerente-${Date.now()}`;

    // Create Workspace
    const newWs: Workspace = {
      id: wsId,
      nome: newWsName.trim(),
      cnpj: '00.000.000/0001-00',
      gerente_id: gerenteId,
      gerente_nome: newWsGerenteName.trim() || 'Gerente Responsável',
      primary_color: '#1e3a8a',
      created_at: new Date().toISOString(),
    };
    StorageService.saveWorkspace(newWs);

    // Create Gerente Account
    const newGerente: User = {
      id: gerenteId,
      workspace_id: wsId,
      nome: newWsGerenteName.trim() || 'Gerente Responsável',
      login: newWsGerenteLogin.trim().toLowerCase(),
      senha: '123',
      role: 'gerente',
      setor: 'Gerência Comercial',
      created_at: new Date().toISOString(),
    };
    StorageService.saveUser(newGerente);

    // Seed default Empresa Emitente for new workspace
    StorageService.saveEmpresaEmitente({
      workspace_id: wsId,
      cnpj: '00.000.000/0001-00',
      razao_social: `${newWsName.trim()} LTDA`,
      endereco: 'Rua Comercial, 100',
      bairro: 'Centro',
      municipio: 'São Paulo',
      uf: 'SP',
      cep: '01000-000',
      telefone: '(11) 3000-0000',
      fax: '(11) 3000-0000',
      inscricao_estadual: 'ISENTO',
    });

    StorageService.logAudit(wsId, currentUser.nome, `Novo Workspace "${newWs.nome}" criado pelo Diretor`, 'Painel Diretor');

    setNewWsName('');
    setNewWsGerenteName('');
    setNewWsGerenteLogin('');
    setIsNewWorkspaceModalOpen(false);
    onRefreshWorkspaces();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Diretor Header */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400 bg-purple-950/80 px-2.5 py-1 rounded-full border border-purple-800/60 inline-flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Nível Diretor • Visão Consolidada Multiempresa</span>
          </span>
          <h2 className="text-xl font-bold tracking-tight text-white">Painel Executivo de Direção</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Acompanhe a performance financeira e isole o controle de cada gerente
          </p>
        </div>

        <button
          onClick={() => setIsNewWorkspaceModalOpen(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-medium text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Workspace</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Workspaces Ativos
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-slate-900">{workspaces.length}</span>
            <Building2 className="w-8 h-8 text-purple-600 opacity-80" />
          </div>
          <span className="text-[11px] text-slate-500 block pt-1">
            Ambientes com isolamento total de RLS
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Volume de Vendas (Consolidado)
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-emerald-700">{formatCurrency(globalQuotationTotal)}</span>
            <TrendingUp className="w-8 h-8 text-emerald-600 opacity-80" />
          </div>
          <span className="text-[11px] text-slate-500 block pt-1">
            Total somado de todas as propostas emitidas
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total de Propostas
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-blue-900">{globalQuotationCount}</span>
            <FileText className="w-8 h-8 text-blue-600 opacity-80" />
          </div>
          <span className="text-[11px] text-slate-500 block pt-1">
            Cotações geradas em todos os Workspaces
          </span>
        </div>
      </div>

      {/* Workspaces List & Quick Switcher */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Gerenciamento de Workspaces & Isolação Multi-Tenant
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {workspaces.map((ws) => {
            const isCurrent = ws.id === activeWorkspace.id;
            const quotes = StorageService.getQuotations(ws.id, currentUser);
            const wsTotal = quotes.reduce((acc, c) => acc + c.valor_total, 0);
            const usersCount = StorageService.getUsersByWorkspace(ws.id).length;

            return (
              <div
                key={ws.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-purple-700 shrink-0" />
                    {inlineEditingWsId === ws.id ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={inlineWsName}
                          onChange={(e) => setInlineWsName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInlineName(ws);
                            if (e.key === 'Escape') setInlineEditingWsId(null);
                          }}
                          autoFocus
                          className="px-2.5 py-1 text-sm font-bold text-slate-900 border-2 border-purple-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInlineName(ws)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                          title="Salvar novo nome da filial"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setInlineEditingWsId(null)}
                          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900 text-sm">{ws.nome}</span>
                        <button
                          type="button"
                          onClick={() => handleStartInlineEdit(ws)}
                          className="p-1 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-md transition-colors cursor-pointer"
                          title="Renomear rapidamente esta filial"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Usuários: <strong>{usersCount}</strong></span>
                    <span>• Propostas: <strong>{quotes.length}</strong></span>
                    <span>• Gerente: <strong className="text-purple-900 font-bold">{ws.gerente_nome || 'Não definido'}</strong></span>
                    <span>• Faturamento: <strong className="text-slate-900">{formatCurrency(wsTotal)}</strong></span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleOpenEditWorkspaceModal(ws)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200/80"
                    title="Editar dados da filial e alocar/substituir gerente"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-purple-700" />
                    <span>Editar Filial / Gerente</span>
                  </button>

                  <button
                    onClick={() => handleDeleteWorkspaceClick(ws)}
                    className="p-2 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors border border-slate-200 hover:border-red-200"
                    title="Excluir esta Filial"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Audit Trail */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 space-y-3">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 block border-b border-slate-100 pb-2">
          Auditoria Global de Operações (Todas as Empresas)
        </span>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
          {allAuditLogs.map((log) => (
            <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900">{log.usuario_nome}</span>
                <span className="text-slate-600 block">{log.acao}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">{formatDateTime(log.data)}</span>
                <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                  {log.modulo}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CREATE WORKSPACE MODAL */}
      {isNewWorkspaceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">
                Criar Novo Workspace (Isolamento Total)
              </h3>
              <button onClick={() => setIsNewWorkspaceModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Nome do Workspace / Filial
                </label>
                <input
                  type="text"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="Ex: SmartVisit - Unidade Sul"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Nome do Gerente Responsável
                </label>
                <input
                  type="text"
                  value={newWsGerenteName}
                  onChange={(e) => setNewWsGerenteName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Login de Acesso do Gerente
                </label>
                <input
                  type="text"
                  value={newWsGerenteLogin}
                  onChange={(e) => setNewWsGerenteLogin(e.target.value)}
                  placeholder="Ex: gerente.sul"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  required
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Senha inicial padrão criada: 123
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewWorkspaceModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-700 text-white rounded-xl text-xs font-bold hover:bg-purple-800"
                >
                  Criar Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE WORKSPACE MODAL */}
      {workspaceToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Excluir Filial</h3>
                <span className="text-xs text-red-600 font-bold block">Esta ação é irreversível</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <p>
                Tem certeza de que deseja remover permanentemente a filial <strong>"{workspaceToDelete.nome}"</strong>?
              </p>
              <p className="text-[11px] text-slate-500">
                Os acessos de gerentes e dados associados a este ambiente serão desvinculados do sistema.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWorkspaceToDelete(null)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteWorkspace}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir Filial</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT WORKSPACE & ALLOCATE MANAGER MODAL */}
      {editingWorkspace && (
        <div 
          onClick={() => setEditingWorkspace(null)}
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto cursor-default"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Editar Dados da Filial e Alocar Gerente
                  </h3>
                  <span className="text-xs text-slate-500">ID Workspace: {editingWorkspace.id}</span>
                </div>
              </div>
              <button 
                onClick={() => setEditingWorkspace(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkspaceEdit} className="space-y-5">
              {/* SECTION 1: DADOS DA FILIAL */}
              <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-100 space-y-3">
                <div className="flex items-center gap-2 text-purple-900 font-extrabold text-xs uppercase tracking-wider">
                  <Building2 className="w-4 h-4" />
                  <span>1. Dados de Identificação da Filial</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Nome da Filial / Unidade *
                    </label>
                    <input
                      type="text"
                      value={editWsName}
                      onChange={(e) => setEditWsName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      CNPJ da Filial
                    </label>
                    <input
                      type="text"
                      value={editWsCnpj}
                      onChange={(e) => setEditWsCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: GERENTE RESPONSÁVEL */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs uppercase tracking-wider">
                  <UserCheck className="w-4 h-4 text-purple-700" />
                  <span>2. Gerente Responsável & Acesso ao Sistema</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Caso o gerente anterior tenha saído, informe abaixo o nome e login do novo gerente para alocá-lo nesta filial.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Nome do Gerente
                    </label>
                    <input
                      type="text"
                      value={editGerenteName}
                      onChange={(e) => setEditGerenteName(e.target.value)}
                      placeholder="Ex: Carlos Costa"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Login de Acesso
                    </label>
                    <input
                      type="text"
                      value={editGerenteLogin}
                      onChange={(e) => setEditGerenteLogin(e.target.value)}
                      placeholder="Ex: gerente.campinas"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Nova Senha (Opcional)
                    </label>
                    <input
                      type="password"
                      value={editGerenteSenha}
                      onChange={(e) => setEditGerenteSenha(e.target.value)}
                      placeholder="Mantenha em branco para manter"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: EMPRESA EMITENTE (PARA PROPOSTAS) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-purple-700" />
                  <span>3. Dados da Empresa Emitente (Cabeçalho de Propostas)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Razão Social no Cabeçalho
                    </label>
                    <input
                      type="text"
                      value={editEmpRazaoSocial}
                      onChange={(e) => setEditEmpRazaoSocial(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      CNPJ Emissor
                    </label>
                    <input
                      type="text"
                      value={editEmpCnpj}
                      onChange={(e) => setEditEmpCnpj(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Inscrição Estadual
                    </label>
                    <input
                      type="text"
                      value={editEmpInscricaoEstadual}
                      onChange={(e) => setEditEmpInscricaoEstadual(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Endereço
                    </label>
                    <input
                      type="text"
                      value={editEmpEndereco}
                      onChange={(e) => setEditEmpEndereco(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={editEmpBairro}
                      onChange={(e) => setEditEmpBairro(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Cidade / Município
                    </label>
                    <input
                      type="text"
                      value={editEmpCidade}
                      onChange={(e) => setEditEmpCidade(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        UF
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={editEmpUf}
                        onChange={(e) => setEditEmpUf(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        CEP
                      </label>
                      <input
                        type="text"
                        value={editEmpCep}
                        onChange={(e) => setEditEmpCep(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Telefone de Contato
                    </label>
                    <input
                      type="text"
                      value={editEmpTelefone}
                      onChange={(e) => setEditEmpTelefone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingWorkspace(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-700/20 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salvar Alterações da Filial</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
