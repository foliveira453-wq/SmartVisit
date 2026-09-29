import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  Download, 
  ShieldAlert, 
  Trash2, 
  Upload, 
  ImagePlus, 
  Image as ImageIcon, 
  Check, 
  Camera, 
  User as UserIcon, 
  UserPlus, 
  AlertTriangle, 
  Users, 
  X, 
  Eye, 
  EyeOff, 
  Key, 
  Lock, 
  Loader2, 
  UploadCloud, 
  FileSpreadsheet
} from 'lucide-react';
import { EmpresaEmitente, User as UserType, Workspace } from '../types';
import { StorageService } from '../lib/storage';
import { formatDateTime, compressImage } from '../lib/pdfPngGenerator';
import { downloadUsuariosModelCSV, importUsuariosFromCSV } from '../lib/csvExportImport';
import {
  supabase,
  getUsersFromSupabase,
  insertUserToSupabase,
  deleteUserFromSupabase,
  deleteAllUsersFromSupabase,
  updateEmpresaEmitenteInSupabase,
} from '../lib/supabaseClient';

interface SettingsModuleProps {
  currentUser: UserType;
  activeWorkspace: Workspace;
  onWorkspaceUpdated: () => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  currentUser,
  activeWorkspace,
  onWorkspaceUpdated,
}) => {
  const [empresa, setEmpresa] = useState<EmpresaEmitente>(() =>
    StorageService.getEmpresaEmitente(activeWorkspace.id)
  );

  const [wsNome, setWsNome] = useState(activeWorkspace.nome);
  const [companyLogo, setCompanyLogo] = useState<string>(() =>
    StorageService.getCompanyLogo() || activeWorkspace.logo_url || ''
  );
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const userAvatarInputRef = useRef<HTMLInputElement>(null);

  const [usersList, setUsersList] = useState<UserType[]>(() =>
    StorageService.getUsers(activeWorkspace.id, currentUser)
  );

  // User Management State (Deletion & Creation)
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [isDeleteAllUsersModalOpen, setIsDeleteAllUsersModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserSenha, setNewUserSenha] = useState('');
  const [newUserSetor, setNewUserSetor] = useState('Vendas');
  const [newUserRole, setNewUserRole] = useState<'vendedor' | 'gestor'>('vendedor');
  const [branchUserMsg, setBranchUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // User Import State
  const [isImportUsersModalOpen, setIsImportUsersModalOpen] = useState(false);
  const [selectedUserImportFile, setSelectedUserImportFile] = useState<File | null>(null);
  const [isProcessingUserImport, setIsProcessingUserImport] = useState(false);
  const [userImportFeedback, setUserImportFeedback] = useState<{ type: 'success' | 'error'; text: string; details?: string[] } | null>(null);

  const handleRunUserImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserImportFile) return;

    setIsProcessingUserImport(true);
    setUserImportFeedback(null);

    try {
      const record = await importUsuariosFromCSV(selectedUserImportFile, activeWorkspace.id, currentUser.nome);
      if (record.status === 'sucesso' || record.status === 'sucesso_parcial') {
        setUserImportFeedback({
          type: 'success',
          text: `Importação concluída! ${record.total_registros} usuário(s) vendedor(es) importado(s) com sucesso.`,
          details: record.mensagens_erro.length > 0 ? record.mensagens_erro : undefined,
        });
        setBranchUserMsg({
          type: 'success',
          text: `${record.total_registros} usuário(s) importado(s) com sucesso via planilha!`,
        });
      } else {
        setUserImportFeedback({
          type: 'error',
          text: `Falha na importação. Encontrado(s) ${record.erros_qtd} erro(s).`,
          details: record.mensagens_erro,
        });
      }
      setSelectedUserImportFile(null);
      setUsersList(StorageService.getUsers(activeWorkspace.id, currentUser));
      window.dispatchEvent(new Event('smartvisit_user_updated'));
    } catch (err: any) {
      setUserImportFeedback({
        type: 'error',
        text: `Erro ao importar arquivo de usuários: ${err?.message || 'Arquivo inválido.'}`,
      });
    } finally {
      setIsProcessingUserImport(false);
    }
  };

  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const loadUsersFromSupabase = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await getUsersFromSupabase(activeWorkspace.id);
      setUsersList(data);
    } catch (err) {
      console.warn('Erro ao carregar usuários do Supabase:', err);
      setUsersList(StorageService.getUsers(activeWorkspace.id, currentUser));
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsersFromSupabase();

    // Inscrição em tempo real para sincronizar usuários e filiais do Supabase
    const channel = supabase
      .channel(`realtime-settings-${activeWorkspace.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => {
        loadUsersFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'filiais' }, () => {
        onWorkspaceUpdated();
      })
      .subscribe();

    const handleUserUpdate = () => {
      loadUsersFromSupabase();
    };
    window.addEventListener('smartvisit_user_updated', handleUserUpdate);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('smartvisit_user_updated', handleUserUpdate);
    };
  }, [activeWorkspace.id, currentUser]);

  const [isSavingEmpresa, setIsSavingEmpresa] = useState(false);
  const [empresaFeedback, setEmpresaFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setEmpresa(StorageService.getEmpresaEmitente(activeWorkspace.id));
    setWsNome(activeWorkspace.nome);
  }, [activeWorkspace.id, activeWorkspace.nome]);

  // Profile Form State
  const [profileNome, setProfileNome] = useState(currentUser.nome);
  const [profileLogin, setProfileLogin] = useState(currentUser.login);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isDiretor = currentUser.role === 'diretor';
  const isGestor = currentUser.role === 'gestor' || currentUser.role === 'gerente';
  const isVendedor = currentUser.role === 'vendedor';
  const isGerenteOrDiretor = isGestor || isDiretor;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    if (!profileNome.trim()) {
      setProfileMsg({ type: 'error', text: 'O nome completo não pode ficar em branco.' });
      return;
    }

    if (!profileLogin.trim()) {
      setProfileMsg({ type: 'error', text: 'O @ de login não pode ficar em branco.' });
      return;
    }

    let updatedPassword = currentUser.senha;
    if (novaSenha.trim()) {
      if (novaSenha !== confirmarNovaSenha) {
        setProfileMsg({ type: 'error', text: 'A confirmação da nova senha não confere.' });
        return;
      }
      if (novaSenha.length < 4) {
        setProfileMsg({ type: 'error', text: 'A nova senha deve ter no mínimo 4 caracteres.' });
        return;
      }
      updatedPassword = novaSenha;
    }

    const cleanLogin = profileLogin.trim().toLowerCase().replace(/^@/, '');
    const freshUser = StorageService.getCurrentUser() || currentUser;

    if (StorageService.isDuplicateUserName(profileNome.trim(), freshUser.id)) {
      setProfileMsg({ 
        type: 'error', 
        text: `Este usuário já existe com o nome "${profileNome.trim()}". Por favor, altere o nome para continuar.` 
      });
      return;
    }

    if (StorageService.isDuplicateUserLogin(cleanLogin, freshUser.id)) {
      setProfileMsg({ 
        type: 'error', 
        text: `Este usuário já existe com o login "${cleanLogin}". Por favor, altere o login para continuar.` 
      });
      return;
    }

    const updatedUser: UserType = {
      ...freshUser,
      nome: profileNome.trim(),
      login: cleanLogin,
      senha: updatedPassword,
    };

    try {
      await insertUserToSupabase(updatedUser);
    } catch (err: any) {
      console.warn('Erro ao atualizar usuário no Supabase:', err);
    }

    StorageService.saveUser(updatedUser);
    await loadUsersFromSupabase();
    setProfileMsg({ type: 'success', text: 'Perfil e credenciais de acesso sincronizados com o Supabase com sucesso!' });
    setNovaSenha('');
    setConfirmarNovaSenha('');
    onWorkspaceUpdated();
  };

  const handleProfileAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).');
        return;
      }
      try {
        const compressedDataUrl = await compressImage(file, 400, 400, 0.85);
        const freshUser = StorageService.getCurrentUser() || currentUser;
        const updated = { ...freshUser, avatar_url: compressedDataUrl };
        StorageService.saveUser(updated);
        setUsersList(StorageService.getUsers(activeWorkspace.id));
        setProfileMsg({ type: 'success', text: 'Foto de perfil atualizada com sucesso!' });
        setTimeout(() => setProfileMsg(null), 3000);
        onWorkspaceUpdated();
      } catch (err) {
        console.error('Erro ao processar imagem de perfil:', err);
        alert('Não foi possível carregar a imagem selecionada. Tente outra imagem.');
      }
    }
  };

  const handleRemoveProfileAvatar = () => {
    if (confirm('Deseja remover sua foto de perfil?')) {
      const freshUser = StorageService.getCurrentUser() || currentUser;
      const updated = { ...freshUser, avatar_url: undefined };
      StorageService.saveUser(updated);
      setUsersList(StorageService.getUsers(activeWorkspace.id, currentUser));
      onWorkspaceUpdated();
    }
  };

  // Branch Users Handlers (Deletion one by one & all at once)
  const handleConfirmDeleteSingleUser = async () => {
    if (!userToDelete) return;
    const target = userToDelete;

    if (target.id === currentUser.id) {
      alert('Você não pode excluir a sua própria conta logada.');
      setUserToDelete(null);
      return;
    }

    if (target.role === 'diretor' && !isDiretor) {
      alert('Apenas diretores podem excluir contas com perfil de Diretor.');
      setUserToDelete(null);
      return;
    }

    try {
      await deleteUserFromSupabase(target.id);
    } catch (err: any) {
      console.error('Erro ao deletar usuário no Supabase:', err);
      setBranchUserMsg({ type: 'error', text: `Erro ao excluir usuário no Supabase: ${err.message}` });
      return;
    }

    StorageService.deleteUser(target.id);
    StorageService.logAudit(
      activeWorkspace.id,
      currentUser.nome,
      `Excluiu o usuário "${target.nome}" (@${target.login}) da filial`,
      'Configurações',
      `Usuário ID: ${target.id} | Função: ${target.role}`,
      'exclusao',
      currentUser.role
    );

    setUsersList(prev => prev.filter(u => u.id !== target.id));
    setBranchUserMsg({ type: 'success', text: `Usuário "${target.nome}" excluído do Supabase com sucesso!` });
    setTimeout(() => setBranchUserMsg(null), 3500);
    setUserToDelete(null);
    onWorkspaceUpdated();
  };

  const handleConfirmDeleteAllUsers = async () => {
    try {
      await deleteAllUsersFromSupabase(activeWorkspace.id, currentUser.id);
    } catch (err: any) {
      console.error('Erro ao deletar usuários no Supabase:', err);
      setBranchUserMsg({ type: 'error', text: `Erro ao excluir usuários no Supabase: ${err.message}` });
      return;
    }

    const deletedCount = StorageService.deleteAllUsersFromWorkspace(activeWorkspace.id, currentUser.id);
    StorageService.logAudit(
      activeWorkspace.id,
      currentUser.nome,
      `Excluiu todos os ${deletedCount} usuários da filial "${activeWorkspace.nome}"`,
      'Configurações',
      `Exclusão em lote executada por ${currentUser.nome} (${currentUser.role})`,
      'exclusao',
      currentUser.role
    );

    setUsersList(prev => prev.filter(u => u.role === 'diretor' || u.id === currentUser.id));
    setBranchUserMsg({ 
      type: 'success', 
      text: `${deletedCount} usuário(s) foram excluídos da filial e sincronizados no Supabase! Sua conta atual foi mantida.` 
    });
    setTimeout(() => setBranchUserMsg(null), 4000);
    setIsDeleteAllUsersModalOpen(false);
    onWorkspaceUpdated();
  };

  const handleCreateBranchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBranchUserMsg(null);

    const cleanName = newUserName.trim();
    const cleanLogin = newUserLogin.trim().toLowerCase().replace(/^@/, '');
    const cleanSenha = newUserSenha.trim() || '123';

    if (!cleanName) {
      setBranchUserMsg({ type: 'error', text: 'Informe o nome completo do novo usuário.' });
      return;
    }

    if (!cleanLogin) {
      setBranchUserMsg({ type: 'error', text: 'Informe o @ de login do novo usuário.' });
      return;
    }

    // Check duplicate in local list first
    if (usersList.some(u => u.nome.trim().toLowerCase() === cleanName.toLowerCase())) {
      setBranchUserMsg({ type: 'error', text: `Este usuário já existe com o nome "${cleanName}".` });
      return;
    }

    if (usersList.some(u => u.login.trim().toLowerCase().replace(/^@/, '') === cleanLogin)) {
      setBranchUserMsg({ type: 'error', text: `Este usuário já existe com o login "${cleanLogin}".` });
      return;
    }

    const newUserId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newUser: UserType = {
      id: newUserId,
      workspace_id: activeWorkspace.id,
      filialId: activeWorkspace.id,
      nome: cleanName,
      login: cleanLogin,
      senha: cleanSenha,
      role: newUserRole,
      setor: newUserSetor.trim() || (newUserRole === 'gestor' ? 'Gerência Comercial' : 'Vendas'),
      created_at: new Date().toISOString(),
    };

    // Chamada direta ao cliente do Supabase
    try {
      const savedUser = await insertUserToSupabase(newUser);
      StorageService.saveUser(savedUser);
      setUsersList(prev => [...prev, savedUser]);
      StorageService.logAudit(
        activeWorkspace.id,
        currentUser.nome,
        `Cadastrou novo ${newUserRole} "${cleanName}" (@${cleanLogin}) na filial`,
        'Configurações',
        `ID: ${newUserId} | Setor: ${newUser.setor}`,
        'criacao',
        currentUser.role
      );

      setBranchUserMsg({ type: 'success', text: `Usuário "${cleanName}" cadastrado e sincronizado com o Supabase!` });
      setTimeout(() => setBranchUserMsg(null), 3500);

      // Reset form
      setNewUserName('');
      setNewUserLogin('');
      setNewUserSenha('');
      setNewUserSetor('Vendas');
      setNewUserRole('vendedor');
      setIsAddUserModalOpen(false);
      onWorkspaceUpdated();
    } catch (err: any) {
      console.error('Erro ao inserir usuário no Supabase:', err);
      setBranchUserMsg({ type: 'error', text: `Erro ao cadastrar no Supabase: ${err.message || 'Falha na gravação.'}` });
    }
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG ou WebP).');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const dataUrl = event.target.result as string;
          setCompanyLogo(dataUrl);
          StorageService.saveCompanyLogo(dataUrl);
          onWorkspaceUpdated();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    if (confirm('Deseja remover a logomarca oficial da empresa?')) {
      setCompanyLogo('');
      StorageService.saveCompanyLogo('');
      onWorkspaceUpdated();
    }
  };

  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmpresa(true);
    setEmpresaFeedback(null);

    try {
      const empresaToSave: EmpresaEmitente = {
        ...empresa,
        workspace_id: activeWorkspace.id,
        filialId: activeWorkspace.id,
        cep: (empresa.cep || '').trim(),
        logo_url: companyLogo || undefined,
      };

      // Chamada direta ao cliente do Supabase
      try {
        await updateEmpresaEmitenteInSupabase(empresaToSave, wsNome.trim());
      } catch (err: any) {
        console.warn('Erro ao atualizar filial no Supabase:', err);
      }

      StorageService.saveEmpresaEmitente(empresaToSave, wsNome.trim());

      const updatedWs: Workspace = {
        ...activeWorkspace,
        nome: wsNome.trim(),
        cnpj: empresa.cnpj.trim() || activeWorkspace.cnpj,
        logo_url: companyLogo || undefined,
      };
      StorageService.saveWorkspace(updatedWs);

      StorageService.logAudit(
        activeWorkspace.id,
        currentUser.nome,
        'Atualizou dados da Empresa Emitente e Filial',
        'Workspace',
        `CNPJ: ${empresa.cnpj} | Razão Social: ${empresa.razao_social} | CEP: ${empresa.cep || 'N/A'}`,
        'edicao',
        currentUser.role
      );

      setEmpresaFeedback({
        type: 'success',
        text: 'Dados da empresa e filial sincronizados no Supabase com sucesso!'
      });
      setTimeout(() => {
        setEmpresaFeedback(null);
      }, 4000);

      onWorkspaceUpdated();
    } catch (err) {
      console.error('Erro ao salvar empresa:', err);
      setEmpresaFeedback({
        type: 'error',
        text: 'Erro ao salvar os dados. Por favor, tente novamente.'
      });
    } finally {
      setIsSavingEmpresa(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>Configurações da Empresa & Filial</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Parametrização da Empresa Emitente, Filial e Gestão de Usuários
          </p>
        </div>

        {empresaFeedback && (
          <div className={`px-3 py-1.5 border text-xs font-semibold rounded-lg flex items-center gap-1.5 ${
            empresaFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {empresaFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
            <span>{empresaFeedback.text}</span>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
          {/* User Profile & Password Management Card */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <UserIcon className="w-4 h-4 text-blue-600" />
                <span>Meu Perfil & Credenciais de Acesso</span>
              </span>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200 uppercase">
                {currentUser.role}
              </span>
            </div>

            {/* Profile Picture Upload Header */}
            <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="relative group shrink-0">
                <div className="relative w-16 h-16 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xl shadow-md overflow-hidden border-2 border-slate-200 uppercase">
                  <span>{currentUser.nome ? currentUser.nome.charAt(0) : 'U'}</span>
                  {currentUser.avatar_url && (
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.nome}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => userAvatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md transition-transform hover:scale-110"
                  title="Subir nova foto de perfil do computador"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 grow">
                <h3 className="text-sm font-bold text-slate-900 leading-none">{currentUser.nome}</h3>
                <p className="text-xs text-slate-500 font-medium">@{currentUser.login} • {currentUser.setor || 'Comercial'}</p>
                
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => userAvatarInputRef.current?.click()}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{currentUser.avatar_url ? 'Alterar Foto' : 'Subir Foto'}</span>
                  </button>

                  {currentUser.avatar_url && (
                    <button
                      type="button"
                      onClick={handleRemoveProfileAvatar}
                      className="px-2.5 py-1 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>

            <input
              ref={userAvatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfileAvatarSelect}
              className="hidden"
            />

            {/* Editable Profile Details Form */}
            <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={profileNome}
                    onChange={(e) => setProfileNome(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 rounded-lg text-xs font-medium text-slate-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    @ Login de Acesso
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">@</span>
                    <input
                      type="text"
                      value={profileLogin.replace(/^@/, '')}
                      onChange={(e) => setProfileLogin(e.target.value)}
                      required
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 rounded-lg text-xs font-medium text-slate-900 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Password Verification & Change Section */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-600" />
                    <span>Verificação & Alteração de Senha</span>
                  </span>

                  {/* Toggle Show Current Password */}
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-blue-700 bg-white border border-slate-200 rounded-lg shadow-xs transition-colors flex items-center gap-1"
                  >
                    {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showCurrentPassword ? 'Ocultar Senha' : 'Verificar Senha'}</span>
                  </button>
                </div>

                {showCurrentPassword && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 font-medium flex items-center justify-between">
                    <span>Sua senha atual de login:</span>
                    <strong className="font-mono text-sm tracking-wider bg-white px-2.5 py-0.5 rounded border border-blue-200 text-slate-900">
                      {currentUser.senha}
                    </strong>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nova Senha (opcional)
                    </label>
                    <input
                      type="password"
                      placeholder="Mínimo 4 caracteres"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 rounded-lg text-xs text-slate-900 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Confirmar Nova Senha
                    </label>
                    <input
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmarNovaSenha}
                      onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 rounded-lg text-xs text-slate-900 transition-all"
                    />
                  </div>
                </div>
              </div>

              {profileMsg && (
                <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  profileMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {profileMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-red-600" />}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Alterações do Perfil</span>
                </button>
              </div>
            </form>
          </div>

          {/* Registered Users List (Organogram: Gerente & Diretor only) */}
          {isGerenteOrDiretor && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Usuários da Filial ({usersList.length})</span>
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Gestão de vendedores e acessos vinculados a esta filial
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserImportFile(null);
                      setUserImportFeedback(null);
                      setIsImportUsersModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 border border-emerald-200"
                    title="Importar usuários vendedores em lote via planilha CSV"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Importar Usuários</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBranchUserMsg(null);
                      setIsAddUserModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 border border-blue-200"
                    title="Adicionar novo vendedor ou gestor nesta filial"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Novo Usuário</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDeleteAllUsersModalOpen(true)}
                    disabled={usersList.filter(u => u.id !== currentUser.id && (isDiretor || u.role !== 'diretor')).length === 0}
                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 border border-red-200"
                    title="Excluir todos os vendedores/usuários desta filial de uma vez só"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>Excluir Todos</span>
                  </button>
                </div>
              </div>

              {branchUserMsg && (
                <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  branchUserMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {branchUserMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-red-600" />}
                  <span>{branchUserMsg.text}</span>
                </div>
              )}

              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1 space-y-1">
                {usersList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Nenhum usuário cadastrado nesta filial.</p>
                ) : (
                  usersList.map((u) => {
                    const isSelf = u.id === currentUser.id;
                    const isOtherDiretor = u.role === 'diretor' && !isDiretor;

                    return (
                      <div key={u.id} className="py-2.5 px-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-3 text-xs transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-slate-200 uppercase shadow-xs">
                            <span>{u.nome ? u.nome.charAt(0) : 'U'}</span>
                            {u.avatar_url && (
                              <img
                                src={u.avatar_url}
                                alt={u.nome}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 truncate">{u.nome}</span>
                              {isSelf && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                  Você (Conectado)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="font-mono text-slate-600">@{u.login}</span>
                              <span>•</span>
                              <span className="capitalize font-medium text-purple-700">{u.role}</span>
                              {u.setor && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-400">{u.setor}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isSelf ? (
                            <span className="text-[10px] text-slate-400 italic px-2">
                              Sua conta
                            </span>
                          ) : isOtherDiretor ? (
                            <span className="text-[10px] text-slate-400 font-semibold px-2">
                              Diretoria
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(u)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                              title={`Excluir usuário "${u.nome}" da filial`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Nota de Privacidade:</strong> A foto de perfil fica unicamente disponível para o próprio vendedor/usuário personalizá-la em seu acesso individual.
                </span>
              </div>
            </div>
          )}

          {/* Empresa Emitente & Workspace Branding Form (Organogram: Gerente & Diretor only) */}
          {isGerenteOrDiretor && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block border-b border-slate-100 pb-2">
                Dados da Empresa Emitente (Propostas)
              </span>

          <form onSubmit={handleSaveEmpresa} className="space-y-4">
            {/* Unified Company Logo Upload (Local File) */}
            <div className="p-4 bg-gradient-to-br from-blue-50/50 to-slate-50 rounded-xl border border-blue-200/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>Logomarca Oficial da Empresa</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Válida e unificada para todas as filiais e impressões de propostas
                  </span>
                </div>
                {companyLogo && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Configurada
                  </span>
                )}
              </div>

              {companyLogo ? (
                <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-slate-200">
                  <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0">
                    <img src={companyLogo} alt="Logo Oficial" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="space-y-1.5 grow">
                    <span className="text-xs font-bold text-slate-800 block">
                      Arquivo de Imagem Local
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Carregado direto do seu computador (armazenado localmente)
                    </p>
                    {isDiretor ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-md transition-colors flex items-center gap-1"
                        >
                          <ImagePlus className="w-3 h-3" />
                          <span>Alterar Imagem</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] rounded-md transition-colors"
                        >
                          Remover
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md inline-flex items-center gap-1 border border-slate-200">
                        <Lock className="w-3 h-3 text-slate-400" />
                        Logomarca oficial fixada (alteração bloqueada)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-white p-4 rounded-xl text-center space-y-2 transition-colors">
                  <Upload className="w-6 h-6 text-blue-500 mx-auto" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Subir Logomarca do Computador
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Formatos aceitos: PNG, JPG, SVG, WebP (Seleção direta de arquivo local)
                    </span>
                  </div>
                  {isGerenteOrDiretor && (
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Selecionar Arquivo</span>
                    </button>
                  )}
                </div>
              )}

              {/* Hidden File Input */}
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileSelect}
                className="hidden"
                disabled={!isGerenteOrDiretor}
              />
            </div>

            {/* Workspace Name */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Nome do Workspace / Filial Atual
              </label>
              <input
                type="text"
                value={wsNome}
                onChange={(e) => setWsNome(e.target.value)}
                disabled={!isGerenteOrDiretor}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            {/* CNPJ & Razao Social */}
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={empresa.cnpj}
                  onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })}
                  disabled={!isGerenteOrDiretor}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Razão Social
                </label>
                <input
                  type="text"
                  value={empresa.razao_social}
                  onChange={(e) => setEmpresa({ ...empresa, razao_social: e.target.value })}
                  disabled={!isGerenteOrDiretor}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  required
                />
              </div>
            </div>

            {/* Endereço, Bairro & CEP */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  placeholder="Rua, Av, Número"
                  value={empresa.endereco || ''}
                  onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })}
                  disabled={!isGerenteOrDiretor}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  placeholder="Bairro"
                  value={empresa.bairro || ''}
                  onChange={(e) => setEmpresa({ ...empresa, bairro: e.target.value })}
                  disabled={!isGerenteOrDiretor}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  placeholder="00000-000"
                  value={empresa.cep || ''}
                  onChange={(e) => setEmpresa({ ...empresa, cep: e.target.value })}
                  disabled={!isGerenteOrDiretor}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
                />
              </div>
            </div>

            {/* Município, UF, Telefone, IE */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Município
                </label>
                <input
                  type="text"
                  value={empresa.municipio}
                  onChange={(e) => setEmpresa({ ...empresa, municipio: e.target.value })}
                  disabled={!isGerenteOrDiretor}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  UF
                </label>
                <input
                  type="text"
                  value={empresa.uf}
                  onChange={(e) => setEmpresa({ ...empresa, uf: e.target.value })}
                  disabled={!isGerenteOrDiretor}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs uppercase font-bold text-center text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  value={empresa.telefone}
                  onChange={(e) => setEmpresa({ ...empresa, telefone: e.target.value })}
                  disabled={!isGerenteOrDiretor}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Inscrição Est.
                </label>
                <input
                  type="text"
                  value={empresa.inscricao_estadual}
                  onChange={(e) => setEmpresa({ ...empresa, inscricao_estadual: e.target.value })}
                  disabled={!isGerenteOrDiretor}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>
            </div>

            {/* Feedback Message Banner */}
            {empresaFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 transition-all ${
                  empresaFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                    : 'bg-red-50 text-red-800 border border-red-200 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2">
                  {empresaFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{empresaFeedback.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmpresaFeedback(null)}
                  className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isGerenteOrDiretor && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {isSavingEmpresa ? 'Salvando dados da filial...' : 'As alterações serão refletidas em orçamentos e relatórios'}
                </span>

                <button
                  type="submit"
                  disabled={isSavingEmpresa}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-2 ${
                    isSavingEmpresa
                      ? 'bg-blue-500 text-white cursor-wait opacity-90'
                      : empresaFeedback?.type === 'success'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer scale-102 ring-2 ring-emerald-400/30'
                      : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 hover:shadow text-white cursor-pointer'
                  }`}
                >
                  {isSavingEmpresa ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Salvando...</span>
                    </>
                  ) : empresaFeedback?.type === 'success' ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Salvo com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar Dados</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>

      {/* SINGLE USER DELETE CONFIRMATION MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-sm">Confirmar Exclusão de Usuário</h3>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Você tem certeza de que deseja remover o usuário <strong className="text-slate-900 font-bold">{userToDelete.nome}</strong> (@{userToDelete.login}) desta filial?
              </p>
              
              <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-[11px] text-red-700 space-y-1">
                <span className="font-bold block">Consequências da exclusão:</span>
                <span>• As credenciais de login deste usuário serão revogadas.</span>
                <span className="block">• Esta ação será registrada no histórico de auditoria.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingleUser}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE ALL USERS CONFIRMATION MODAL */}
      {isDeleteAllUsersModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-sm">Excluir TODOS os Usuários da Filial</h3>
              </div>
              <button
                onClick={() => setIsDeleteAllUsersModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Atenção: Você está prestes a remover <strong className="text-red-700 underline">TODOS os vendedores e usuários</strong> vinculados à filial <strong className="text-slate-900 font-bold">{activeWorkspace.nome}</strong>.
              </p>
              
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-[11px] text-red-800 space-y-1.5">
                <div className="font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Ação Irreversível de Lote:</span>
                </div>
                <span>• Todos os acessos de vendedores desta filial serão excluídos permanentemente.</span>
                <span className="block font-semibold text-emerald-800 bg-emerald-50 p-1.5 rounded border border-emerald-200">
                  ✓ Sua conta atual conectada ({currentUser.nome}) e contas da Diretoria serão preservadas com total segurança.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteAllUsersModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAllUsers}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir Todos de Uma Vez</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD USER MODAL (NO PHOTO UPLOAD - ONLY THE USER CAN SET THEIR OWN PHOTO) */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Cadastrar Novo Usuário na Filial</h3>
              </div>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranchUser} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Oliveira"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg text-xs text-slate-900 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Login / @Usuário *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">@</span>
                    <input
                      type="text"
                      required
                      placeholder="carlos.vendas"
                      value={newUserLogin}
                      onChange={(e) => setNewUserLogin(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg text-xs font-mono text-slate-900 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Senha Inicial *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="123"
                    value={newUserSenha}
                    onChange={(e) => setNewUserSenha(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg text-xs text-slate-900 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Perfil de Acesso
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'vendedor' | 'gestor')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg text-xs font-medium text-slate-900 transition-all"
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="gestor">Gerente / Gestor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Setor / Departamento
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Comercial"
                    value={newUserSetor}
                    onChange={(e) => setNewUserSetor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg text-xs text-slate-900 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Nota:</strong> A foto de perfil não pode ser enviada por terceiros e fica reservada para o próprio usuário adicionar em seu perfil após login.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Cadastrar Usuário</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORTAR USUÁRIOS VENDEDORES */}
      {isImportUsersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Importar Usuários Vendedores
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cadastre vendedores em lote para esta filial via planilha CSV
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportUsersModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Modelo de Planilha de Usuários
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Colunas: Login; Senha; Nome; Setor
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadUsuariosModelCSV}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-2xs shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Baixar Modelo CSV</span>
                </button>
              </div>
            </div>

            {/* Feedback Alert */}
            {userImportFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  userImportFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {userImportFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{userImportFeedback.text}</span>
                </div>
                {userImportFeedback.details && userImportFeedback.details.length > 0 && (
                  <div className="pl-6 text-[11px] space-y-0.5 text-slate-600 max-h-24 overflow-y-auto">
                    {userImportFeedback.details.map((msg, i) => (
                      <div key={i}>• {msg}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upload Form */}
            <form onSubmit={handleRunUserImport} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Selecione o Arquivo CSV
                </label>
                <div className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-4 transition-colors bg-slate-50/50 text-center">
                  <input
                    type="file"
                    id="users-file-input"
                    accept=".csv,.txt,.xlsx"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedUserImportFile(e.target.files[0]);
                        setUserImportFeedback(null);
                      }
                    }}
                    className="hidden"
                  />
                  {selectedUserImportFile ? (
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-800 truncate max-w-xs">
                            {selectedUserImportFile.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {(selectedUserImportFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedUserImportFile(null)}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="users-file-input"
                      className="cursor-pointer flex flex-col items-center gap-1.5 py-3"
                    >
                      <UploadCloud className="w-8 h-8 text-emerald-600 opacity-80" />
                      <span className="text-xs font-semibold text-slate-700">
                        Clique para escolher o arquivo CSV de usuários
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Formatado com delimitador ponto e vírgula (;) ou vírgula (,)
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsImportUsersModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={!selectedUserImportFile || isProcessingUserImport}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {isProcessingUserImport ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando Importação...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Processar Importação</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

