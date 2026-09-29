import React from 'react';
import { LayoutGrid, FileText, PackageSearch, Settings, ShieldAlert } from 'lucide-react';
import { UserRole } from '../types';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, userRole }) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 px-2 py-1 shadow-2xl">
      <div className="flex items-center justify-around">
        {/* Feed */}
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
            activeTab === 'feed' ? 'text-blue-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Feed</span>
        </button>

        {/* Vendas */}
        <button
          onClick={() => setActiveTab('quotations')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
            activeTab === 'quotations' ? 'text-blue-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Vendas</span>
        </button>

        {/* PDV & Produtos */}
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
            activeTab === 'catalog' ? 'text-blue-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PackageSearch className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">PDV & Prod.</span>
        </button>

        {/* Configurações */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
            activeTab === 'settings' ? 'text-blue-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Ajustes</span>
        </button>

        {userRole === 'diretor' && (
          <button
            onClick={() => setActiveTab('diretor')}
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
              activeTab === 'diretor' ? 'text-purple-400 font-bold scale-105' : 'text-slate-400 hover:text-purple-200'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Direção</span>
          </button>
        )}
      </div>
    </div>
  );
};
