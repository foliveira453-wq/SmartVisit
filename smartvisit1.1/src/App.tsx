import React, { useState, useEffect } from 'react';
import { User, Workspace } from './types';
import { StorageService } from './lib/storage';
import { getFiliaisFromSupabase, supabase } from './lib/supabaseClient';
import { LoginModal } from './components/LoginModal';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';

// Modules
import { FeedModule } from './components/FeedModule';
import { QuotationsModule } from './components/QuotationsModule';
import { ClientsProductsModule } from './components/ClientsProductsModule';
import { SettingsModule } from './components/SettingsModule';
import { DiretorPanel } from './components/DiretorPanel';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => StorageService.getCurrentUser());
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => StorageService.getWorkspaces());

  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string>(() => {
    const savedWs = StorageService.getActiveWorkspaceId();
    if (currentUser) {
      if (currentUser.role !== 'diretor') {
        return currentUser.workspace_id || currentUser.filialId || savedWs || 'ws-pi100';
      }
      if (savedWs) return savedWs;
      return currentUser.workspace_id || 'ws-pi100';
    }
    if (savedWs) return savedWs;
    const ws = StorageService.getWorkspaces();
    return ws.length > 0 ? ws[0].id : 'ws-pi100';
  });

  const setActiveWorkspaceId = (wsId: string) => {
    setActiveWorkspaceIdState(wsId);
    StorageService.setActiveWorkspaceId(wsId);
  };

  const [activeTab, setActiveTabState] = useState<string>(() => {
    const savedTab = StorageService.getActiveTab();
    if (savedTab) {
      if (savedTab === 'imports' || savedTab === 'ai_specialist') {
        return 'catalog';
      }
      // Validate permissions for saved tab
      if (savedTab === 'diretor' && currentUser?.role !== 'diretor') {
        return 'feed';
      }
      return savedTab;
    }
    return 'feed';
  });

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    StorageService.setActiveTab(tab);
  };

  useEffect(() => {
    const handleUserUpdate = () => {
      const updated = StorageService.getCurrentUser();
      if (updated) setCurrentUser(updated);
    };
    const handleWsUpdate = () => {
      setWorkspaces(StorageService.getWorkspaces());
    };
    window.addEventListener('smartvisit_user_updated', handleUserUpdate);
    window.addEventListener('smartvisit_workspaces_updated', handleWsUpdate);

    // Carrega e sincroniza filiais em tempo real do banco Supabase
    getFiliaisFromSupabase().then(res => {
      if (res.workspaces && res.workspaces.length > 0) {
        setWorkspaces(res.workspaces);
      }
    }).catch(err => {
      console.warn('Erro ao carregar filiais do Supabase no App:', err);
    });

    const channel = supabase
      .channel('realtime-filiais-app')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'filiais' }, () => {
        getFiliaisFromSupabase().then(res => {
          if (res.workspaces && res.workspaces.length > 0) {
            setWorkspaces(res.workspaces);
          }
        });
      })
      .subscribe();

    return () => {
      window.removeEventListener('smartvisit_user_updated', handleUserUpdate);
      window.removeEventListener('smartvisit_workspaces_updated', handleWsUpdate);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    const targetWs = user.role === 'diretor'
      ? (StorageService.getActiveWorkspaceId() || user.workspace_id || user.filialId || 'ws-pi100')
      : (user.workspace_id || user.filialId || 'ws-pi100');
    setActiveWorkspaceId(targetWs);
    
    const lastTab = StorageService.getActiveTab() || 'feed';
    if (user.role !== 'diretor' && lastTab === 'diretor') {
      setActiveTab('feed');
    } else {
      setActiveTab(lastTab);
    }
  };

  const handleLogout = () => {
    StorageService.setCurrentUser(null);
    setCurrentUser(null);
  };

  const handleRefreshWorkspaces = () => {
    setWorkspaces(StorageService.getWorkspaces());
  };

  const handleSelectWorkspace = (wsId: string) => {
    if (currentUser && currentUser.role !== 'diretor') {
      return; // Apenas o diretor tem permissão para alternar filiais
    }
    setActiveWorkspaceId(wsId);
    window.dispatchEvent(new CustomEvent('smartvisit_workspace_changed', { detail: { workspaceId: wsId } }));
  };

  // Find active workspace object
  const activeWorkspace: Workspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0] || {
    id: activeWorkspaceId,
    nome: 'SmartVisit Workspace',
    cnpj: '00.000.000/0001-00',
    primary_color: '#1e3a8a',
    created_at: new Date().toISOString()
  };

  if (!currentUser) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        activeWorkspace={activeWorkspace}
        workspaces={workspaces}
        onSelectWorkspace={handleSelectWorkspace}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'feed' && (
          <FeedModule key={activeWorkspace.id} currentUser={currentUser} workspaceId={activeWorkspace.id} />
        )}

        {activeTab === 'quotations' && (
          <QuotationsModule key={activeWorkspace.id} currentUser={currentUser} workspaceId={activeWorkspace.id} />
        )}

        {activeTab === 'catalog' && (
          <ClientsProductsModule
            key={activeWorkspace.id}
            currentUser={currentUser}
            workspaceId={activeWorkspace.id}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsModule
            key={activeWorkspace.id}
            currentUser={currentUser}
            activeWorkspace={activeWorkspace}
            onWorkspaceUpdated={handleRefreshWorkspaces}
          />
        )}

        {activeTab === 'diretor' && currentUser.role === 'diretor' && (
          <DiretorPanel
            key={activeWorkspace.id}
            currentUser={currentUser}
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            onSelectWorkspace={handleSelectWorkspace}
            onRefreshWorkspaces={handleRefreshWorkspaces}
          />
        )}
      </main>

      {/* Corporate Status Footer */}
      <footer className="hidden sm:flex h-8 bg-white border-t border-slate-200 px-6 items-center justify-between text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-4">
          {currentUser?.role !== 'diretor' && (
            <span>Workspace: <strong className="text-slate-800 font-mono">{activeWorkspace.nome}</strong></span>
          )}
          <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sistema Ativo
          </span>
        </div>
        <div>© 2026 SmartVisit - Gestão Comercial Corporativa (v2.4.0)</div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={currentUser.role}
      />
    </div>
  );
}
