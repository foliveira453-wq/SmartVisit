import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  LogOut, 
  ChevronDown, 
  ShieldCheck, 
  UserCheck, 
  Briefcase,
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  MessageSquare,
  FileText,
  Bot,
  Info
} from 'lucide-react';
import { User, Workspace, NotificationItem } from '../types';
import { StorageService } from '../lib/storage';
import { formatDateTime } from '../lib/pdfPngGenerator';

interface NavbarProps {
  currentUser: User;
  activeWorkspace: Workspace;
  workspaces: Workspace[];
  onSelectWorkspace: (wsId: string) => void;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeWorkspace,
  workspaces,
  onSelectWorkspace,
  onLogout,
  activeTab,
  setActiveTab,
}) => {
  const isDiretor = currentUser.role === 'diretor';
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const loadNotifs = () => {
    const list = StorageService.getNotifications(activeWorkspace.id, currentUser);
    setNotifications(list);
  };

  useEffect(() => {
    loadNotifs();

    const handleNotifEvent = () => loadNotifs();

    window.addEventListener('smartvisit_notification_created', handleNotifEvent);
    window.addEventListener('smartvisit_notifications_updated', handleNotifEvent);

    // Poll every 4 seconds for real-time sync across simulated users/tabs
    const interval = setInterval(() => {
      loadNotifs();
    }, 4000);

    return () => {
      window.removeEventListener('smartvisit_notification_created', handleNotifEvent);
      window.removeEventListener('smartvisit_notifications_updated', handleNotifEvent);
      clearInterval(interval);
    };
  }, [activeWorkspace.id, currentUser]);

  const unreadCount = notifications.filter(n => !n.lida).length;

  const handleMarkAsRead = (id: string, linkTab?: string) => {
    StorageService.markNotificationAsRead(id);
    loadNotifs();
    if (linkTab) {
      setActiveTab(linkTab);
      setIsNotifOpen(false);
    }
  };

  const handleMarkAllRead = () => {
    StorageService.markAllNotificationsAsRead(activeWorkspace.id, currentUser);
    loadNotifs();
  };

  const handleClearNotifs = () => {
    StorageService.clearNotifications(activeWorkspace.id);
    loadNotifs();
  };

  const getNotifIcon = (tipo: NotificationItem['tipo']) => {
    switch (tipo) {
      case 'feed':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'orcamento':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'ai_doc':
        return <Bot className="w-4 h-4 text-purple-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'diretor':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Diretor</span>;
      case 'gestor':
      case 'gerente':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1"><UserCheck className="w-3 h-3"/> Gestor</span>;
      default:
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1"><Briefcase className="w-3 h-3"/> Vendedor</span>;
    }
  };

  return (
    <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-sm border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Title without image */}
          <div className="flex items-center">
            <span className="text-base sm:text-lg font-black tracking-tight text-white select-none">
              <span className="text-blue-500">Smart</span>Visit
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'feed'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Feed Interno
            </button>
            <button
              onClick={() => setActiveTab('quotations')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'quotations'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Vendas
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'catalog'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              PDV & Produtos
            </button>
            
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Configurações
            </button>

            {isDiretor && (
              <button
                onClick={() => setActiveTab('diretor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'diretor'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-purple-300 hover:bg-purple-900/50 hover:text-purple-100'
                }`}
              >
                Painel Diretor
              </button>
            )}
          </nav>

          {/* Notifications & User Profile & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-Time Bell Icon */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
                title="Notificações do Sistema"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-black border-2 border-slate-900 animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Popover Dropdown */}
              {isNotifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsNotifOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-slate-900">
                    <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-400" />
                        <span className="font-bold text-xs uppercase tracking-wider">
                          Notificações ({notifications.length})
                        </span>
                        {unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.2 rounded-full">
                            {unreadCount} não lidas
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="p-1 text-slate-400 hover:text-blue-300 transition-colors"
                            title="Marcar todas como lidas"
                          >
                            <CheckCheck className="w-4 h-4" />
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            onClick={handleClearNotifs}
                            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                            title="Limpar todas as notificações"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-500" />
                          <span>Nenhuma notificação recente.</span>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => handleMarkAsRead(notif.id, notif.link_tab)}
                            className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 ${
                              !notif.lida ? 'bg-blue-50/40' : ''
                            }`}
                          >
                            <div className="p-2 bg-slate-100 rounded-xl shrink-0 mt-0.5">
                              {getNotifIcon(notif.tipo)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className={`text-xs font-bold truncate ${!notif.lida ? 'text-blue-950 font-black' : 'text-slate-800'}`}>
                                  {notif.titulo}
                                </h4>
                                {!notif.lida && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                                {notif.mensagem}
                              </p>
                              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                                <span>{formatDateTime(notif.data)}</span>
                                {notif.link_tab && (
                                  <span className="text-blue-600 font-bold flex items-center gap-0.5">
                                    Ver <ExternalLink className="w-3 h-3" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Branch Selector (Diretor only) or Fixed Branch Display (Gestor / Vendedor) */}
            {isDiretor ? (
              <div className="relative flex items-center" title="Alterar filial ativa (Acesso Diretor)">
                <Building2 className="w-3.5 h-3.5 text-blue-400 absolute left-2.5 pointer-events-none" />
                <select
                  value={activeWorkspace.id}
                  onChange={(e) => onSelectWorkspace(e.target.value)}
                  className="appearance-none bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs py-1.5 pl-8 pr-7 rounded-lg border border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xs max-w-[140px] sm:max-w-[185px] truncate"
                >
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id} className="bg-slate-900 text-white font-medium">
                      {ws.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-300 absolute right-2 pointer-events-none" />
              </div>
            ) : (
              <div 
                className="flex items-center gap-1.5 bg-slate-800/90 text-slate-200 font-semibold text-xs py-1.5 px-3 rounded-lg border border-slate-700/80 max-w-[140px] sm:max-w-[200px] truncate shadow-xs select-none"
                title={`Filial vinculada: ${activeWorkspace.nome}`}
              >
                <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">{activeWorkspace.nome}</span>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs border border-slate-700 shadow-xs shrink-0 overflow-hidden uppercase">
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
              <div className="hidden lg:block text-left">
                <span className="text-xs font-semibold text-slate-100 block truncate max-w-[120px]">
                  {currentUser.nome}
                </span>
                {getRoleBadge(currentUser.role)}
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
