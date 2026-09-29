import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User as UserIcon, ShieldAlert, Loader2 } from 'lucide-react';
import { User } from '../types';
import { StorageService } from '../lib/storage';
import { verifyUserLoginInSupabase } from '../lib/supabaseClient';

interface LoginModalProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!login.trim() || !senha.trim()) {
      setErrorMsg('Por favor, preencha o login e a senha.');
      return;
    }

    setIsAuthenticating(true);

    try {
      // 1. Verificação direta em tempo real no banco Supabase
      const supabaseUser = await verifyUserLoginInSupabase(login, senha);

      if (supabaseUser) {
        StorageService.saveUser(supabaseUser);
        StorageService.setCurrentUser(supabaseUser);
        StorageService.logAudit(supabaseUser.workspace_id, supabaseUser.nome, 'Login efetuado com sucesso', 'Autenticação');
        onLoginSuccess(supabaseUser);
        return;
      }

      // 2. Fallback de contingência para usuários locais pré-existentes
      const allUsers = StorageService.getUsers();
      const found = allUsers.find(
        u => u.login.trim().toLowerCase() === login.trim().toLowerCase() && u.senha === senha.trim()
      );

      if (found) {
        StorageService.setCurrentUser(found);
        StorageService.logAudit(found.workspace_id, found.nome, 'Login efetuado com sucesso', 'Autenticação');
        onLoginSuccess(found);
      } else {
        setErrorMsg('Login ou senha incorretos. Tente novamente.');
      }
    } catch (err: any) {
      console.error('Erro na autenticação:', err);
      setErrorMsg('Erro ao conectar ao serviço de autenticação. Verifique sua conexão.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-auto">
        {/* Brand Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-8 text-white text-center relative overflow-hidden">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg mb-3 shadow-sm text-white font-bold text-sm">
            SV
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">SmartVisit</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Gestão Comercial Corporativa & Orçamentos
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-lg border border-red-200">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Login Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Login / E-mail Corporativo
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="seu.email@empresa.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none cursor-pointer"
                  title={showSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isAuthenticating && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isAuthenticating ? 'Conectando ao Supabase...' : 'Acessar o Sistema'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
