import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Plus, 
  FileText, 
  Trash2, 
  Sparkles, 
  BookOpen, 
  Link as LinkIcon, 
  MessageSquare, 
  Clock, 
  User as UserIcon, 
  Loader2,
  Youtube,
  Globe,
  FileCode,
  ExternalLink,
  X,
  Check,
  Copy,
  Layers,
  CheckSquare,
  Square,
  FileUp,
  FileQuestion,
  FileCheck2,
  Maximize2
} from 'lucide-react';
import { AIDocument, AIConversation, AIMessage, AICitation, User } from '../types';
import { StorageService } from '../lib/storage';

interface AISpecialistModuleProps {
  currentUser: User;
  workspaceId: string;
}

export const AISpecialistModule: React.FC<AISpecialistModuleProps> = ({ currentUser, workspaceId }) => {
  const [documents, setDocuments] = useState<AIDocument[]>(() => StorageService.getAIDocuments(workspaceId));
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(() => {
    const docs = StorageService.getAIDocuments(workspaceId);
    return docs.map(d => d.id);
  });

  const [conversations, setConversations] = useState<AIConversation[]>(() => 
    StorageService.getAIConversations(workspaceId, currentUser)
  );

  // Chat is always available: if no conversation exists, initialize a live conversation automatically
  const [activeConversation, setActiveConversation] = useState<AIConversation>(() => {
    const list = StorageService.getAIConversations(workspaceId, currentUser);
    if (list.length > 0) return list[0];

    const defaultConv: AIConversation = {
      id: `conv-${Date.now()}`,
      workspace_id: workspaceId,
      usuario_id: currentUser.id,
      usuario_nome: currentUser.nome,
      titulo: 'Consulta Técnica NotebookLM',
      mensagens: [
        {
          id: `msg-welcome`,
          sender: 'ai',
          text: `Olá, **${currentUser.nome}**! Sou o assistente especialista ancorado nos materiais e catálogo do seu Workspace.\n\nVocê pode me fazer qualquer pergunta sobre especificações, preços, aplicações técnicas ou me pedir para **comparar produtos**. Estou pronto para te atender!`,
          timestamp: new Date().toISOString(),
        }
      ],
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    StorageService.saveAIConversation(defaultConv);
    return defaultConv;
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Citation inspection drawer / modal
  const [activeCitationForModal, setActiveCitationForModal] = useState<AICitation | null>(null);
  const [copiedCitationSnippet, setCopiedCitationSnippet] = useState(false);

  // Source preview modal
  const [viewingSourceDoc, setViewingSourceDoc] = useState<AIDocument | null>(null);

  // Add Source Modal (NotebookLM style)
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [sourceTab, setSourceTab] = useState<'local' | 'web' | 'youtube' | 'gdocs'>('local');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestFeedback, setIngestFeedback] = useState<string | null>(null);

  // Form inputs for sources
  const [webUrl, setWebUrl] = useState('');
  const [webTitle, setWebTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [gdocsUrl, setGdocsUrl] = useState('');
  const [gdocsTitle, setGdocsTitle] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canManageDocs = currentUser.role === 'gerente' || currentUser.role === 'diretor';

  const refreshData = () => {
    const updatedDocs = StorageService.getAIDocuments(workspaceId);
    setDocuments(updatedDocs);
    const updatedConvs = StorageService.getAIConversations(workspaceId, currentUser);
    setConversations(updatedConvs);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation.mensagens, isGenerating]);

  // Ensure documents are selected by default when newly added
  useEffect(() => {
    setSelectedDocIds(prev => {
      const validIds = new Set(documents.map(d => d.id));
      const filtered = prev.filter(id => validIds.has(id));
      // Add any new docs
      documents.forEach(d => {
        if (!prev.includes(d.id)) filtered.push(d.id);
      });
      return filtered.length > 0 ? filtered : documents.map(d => d.id);
    });
  }, [documents.length]);

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversation.id]);

  // Create a new chat thread (always available via sidebar + icon)
  const handleStartNewChat = () => {
    const newConv: AIConversation = {
      id: `conv-${Date.now()}`,
      workspace_id: workspaceId,
      usuario_id: currentUser.id,
      usuario_nome: currentUser.nome,
      titulo: `Conversa ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      mensagens: [
        {
          id: `msg-welcome-${Date.now()}`,
          sender: 'ai',
          text: `Nova conversa iniciada. Estou ancorado nos documentos selecionados da base. Como posso ajudar?`,
          timestamp: new Date().toISOString(),
        }
      ],
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    StorageService.saveAIConversation(newConv);
    setActiveConversation(newConv);
    refreshData();
    inputRef.current?.focus();
  };

  // Toggle selection of a document for query filtering
  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectAllDocs = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(documents.map(d => d.id));
    }
  };

  // ==============================================================================
  // SOURCE INGESTION: Local Files (PDF, TXT, MD)
  // ==============================================================================
  const handleLocalFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsIngesting(true);
    setIngestFeedback('Processando e gerando embeddings para arquivos locais...');

    try {
      let count = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        let typePayload = 'file';
        let contentPayload = '';

        if (ext === 'pdf') {
          typePayload = 'pdf';
          contentPayload = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const res = reader.result as string;
              resolve(res.includes(',') ? res.split(',')[1] : res);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        } else if (['md', 'markdown'].includes(ext)) {
          typePayload = 'md';
          contentPayload = await file.text();
        } else {
          typePayload = 'texto';
          contentPayload = await file.text();
        }

        const res = await fetch('/api/ai/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            type: typePayload,
            name: file.name,
            content: contentPayload,
            authorName: currentUser.nome,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.document) {
            StorageService.saveAIDocument(data.document);
            count++;
          }
        } else {
          const errData = await res.json();
          console.warn(`Erro no upload de ${file.name}:`, errData);
        }
      }

      refreshData();
      setIsAddSourceModalOpen(false);
      setIngestFeedback(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert(`${count} arquivo(s) local(is) indexado(s) com sucesso com embeddings no Especialista IA!`);
    } catch (err: any) {
      console.error('Erro ao importar arquivos locais:', err);
      alert('Erro ao processar arquivos locais: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setIsIngesting(false);
      setIngestFeedback(null);
    }
  };

  // ==============================================================================
  // SOURCE INGESTION: Web URL, YouTube, Google Docs/Slides
  // ==============================================================================
  const handleIngestExternalSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsIngesting(true);
    setIngestFeedback('Conectando à fonte, extraindo texto limpo e indexando vetores...');

    try {
      let payload: any = {
        workspaceId,
        authorName: currentUser.nome,
      };

      if (sourceTab === 'web') {
        if (!webUrl.trim()) return;
        payload = {
          ...payload,
          type: 'web',
          url: webUrl.trim(),
          name: webTitle.trim() || undefined,
        };
      } else if (sourceTab === 'youtube') {
        if (!youtubeUrl.trim()) return;
        payload = {
          ...payload,
          type: 'youtube',
          url: youtubeUrl.trim(),
          name: youtubeTitle.trim() || undefined,
        };
      } else if (sourceTab === 'gdocs') {
        if (!gdocsUrl.trim()) return;
        const isSlides = gdocsUrl.includes('/presentation/');
        payload = {
          ...payload,
          type: isSlides ? 'gslides' : 'gdocs',
          url: gdocsUrl.trim(),
          name: gdocsTitle.trim() || undefined,
        };
      }

      const res = await fetch('/api/ai/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao processar fonte.');
      }

      if (data.document) {
        StorageService.saveAIDocument(data.document);
        refreshData();
        setIsAddSourceModalOpen(false);
        setWebUrl('');
        setWebTitle('');
        setYoutubeUrl('');
        setYoutubeTitle('');
        setGdocsUrl('');
        setGdocsTitle('');
        alert(`Fonte "${data.document.nome}" adicionada com sucesso (${data.chunksCount || 1} blocos vetoriais indexados)!`);
      }
    } catch (err: any) {
      console.error('Erro na ingestão externa:', err);
      alert('Não foi possível indexar a fonte: ' + (err.message || 'Verifique o link e tente novamente.'));
    } finally {
      setIsIngesting(false);
      setIngestFeedback(null);
    }
  };

  // Delete source document and its vector chunks
  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (window.confirm(`Excluir permanentemente a fonte "${docName}" da Base de Conhecimento da IA?`)) {
      try {
        await fetch(`/api/ai/documents/${docId}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('Erro ao chamar delete no backend:', e);
      }
      StorageService.deleteAIDocument(docId);
      StorageService.logAudit(workspaceId, currentUser.nome, `Excluiu fonte de conhecimento: "${docName}"`, 'Especialista IA');
      refreshData();
    }
  };

  // ==============================================================================
  // SEND MESSAGE: Full RAG pipeline with "Prompt de Ferro" & Citations
  // ==============================================================================
  const handleSendMessage = async (e?: React.FormEvent, directMessage?: string) => {
    if (e) e.preventDefault();
    const textToSend = directMessage || inputMessage;
    if (!textToSend.trim() || isGenerating) return;

    const userText = textToSend.trim();
    setInputMessage('');

    // Append user message immediately
    const userMsg: AIMessage = {
      id: `msg-u-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
    };

    const currentMessages = [...activeConversation.mensagens, userMsg];
    
    // Auto-update conversation title from the first question
    const updatedTitle = activeConversation.mensagens.length <= 1 
      ? (userText.length > 35 ? `${userText.slice(0, 35)}...` : userText)
      : activeConversation.titulo;

    const updatedConv: AIConversation = {
      ...activeConversation,
      titulo: updatedTitle,
      mensagens: currentMessages,
      atualizado_em: new Date().toISOString(),
    };

    setActiveConversation(updatedConv);
    StorageService.saveAIConversation(updatedConv);
    setIsGenerating(true);

    try {
      const products = StorageService.getProdutos(workspaceId);
      const workspaces = StorageService.getWorkspaces();
      const currentWs = workspaces.find(w => w.id === workspaceId);

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          workspaceId,
          conversationHistory: currentMessages,
          selectedDocumentIds: selectedDocIds,
          knowledgeDocuments: documents.filter(d => selectedDocIds.includes(d.id)),
          products,
          workspaceName: currentWs?.nome || 'SmartVisit Workspace',
        }),
      });

      const data = await response.json();
      const aiReplyText = data.reply || 'Não encontrei essa informação nas fontes.';
      const citations: AICitation[] = data.citations || [];

      const aiMsg: AIMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: 'ai',
        text: aiReplyText,
        citations,
        sources: citations.map(c => c.document_name),
        timestamp: new Date().toISOString(),
      };

      const finalConv: AIConversation = {
        ...updatedConv,
        mensagens: [...currentMessages, aiMsg],
        atualizado_em: new Date().toISOString(),
      };

      setActiveConversation(finalConv);
      StorageService.saveAIConversation(finalConv);
      refreshData();
    } catch (err) {
      console.error('Erro na consulta RAG:', err);
      const errorMsg: AIMessage = {
        id: `msg-ai-err-${Date.now()}`,
        sender: 'ai',
        text: 'Não foi possível consultar as fontes no momento. Verifique sua conexão e tente novamente.',
        timestamp: new Date().toISOString(),
      };
      const finalConv = {
        ...updatedConv,
        mensagens: [...currentMessages, errorMsg],
      };
      setActiveConversation(finalConv);
      StorageService.saveAIConversation(finalConv);
    } finally {
      setIsGenerating(false);
      inputRef.current?.focus();
    }
  };

  // Render message text with interactive clickable citation badges [1], [2]
  const renderMessageWithCitations = (text: string, citations?: AICitation[]) => {
    if (!citations || citations.length === 0) {
      return <div className="whitespace-pre-wrap">{text}</div>;
    }

    // Split text by citation markers like [1], [2]
    const parts = text.split(/(\[\d+\])/g);

    return (
      <div className="whitespace-pre-wrap">
        {parts.map((part, idx) => {
          const match = part.match(/^\[(\d+)\]$/);
          if (match) {
            const citeNum = parseInt(match[1], 10);
            const citation = citations.find(c => c.index === citeNum);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => citation && setActiveCitationForModal(citation)}
                className="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 text-[10px] font-black bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 rounded-md transition-all shadow-2xs hover:scale-110 cursor-pointer align-baseline"
                title={citation ? `Ver trecho de "${citation.document_name}"` : 'Ver citação'}
              >
                [{citeNum}]
              </button>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };

  // Helper icon for source types
  const getSourceIcon = (tipo: string) => {
    switch (tipo) {
      case 'pdf': return <FileText className="w-4 h-4 text-red-600 shrink-0" />;
      case 'web': return <Globe className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'youtube': return <Youtube className="w-4 h-4 text-rose-600 shrink-0" />;
      case 'gdocs': 
      case 'gslides': return <FileCode className="w-4 h-4 text-blue-600 shrink-0" />;
      case 'md': return <FileCode className="w-4 h-4 text-purple-600 shrink-0" />;
      default: return <FileText className="w-4 h-4 text-slate-600 shrink-0" />;
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Hidden file input for local uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleLocalFilesUpload}
        multiple
        className="hidden"
        accept=".pdf,.txt,.md,.markdown"
      />

      {/* Top Banner (Removed 'Manual / texto' and 'Nova consulta' buttons as requested) */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-700/20 shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Especialista Técnico IA</span>
              <span className="text-[10px] bg-blue-100 text-blue-900 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                NotebookLM RAG
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chat inteligente ancorado com fidelidade máxima aos PDFs, links e catálogo de produtos do Workspace
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <BookOpen className="w-4 h-4 text-blue-700" />
            <span className="font-bold">{documents.length}</span>
            <span className="text-slate-500">fontes cadastradas</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-[11px]">Chat Ativo</span>
          </div>
        </div>
      </div>

      {/* Main Grid: NotebookLM Layout (Left: Sources & History, Right: Continuous Chat) */}
      <div className="grid lg:grid-cols-12 gap-5">
        
        {/* ============================================================================== */}
        {/* LEFT COLUMN: Sources Panel & Conversations List */}
        {/* ============================================================================== */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Card: Fontes da Base (NotebookLM Sources) */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Fontes ({selectedDocIds.length}/{documents.length})
                </span>
              </div>

              {canManageDocs && (
                <button
                  type="button"
                  onClick={() => setIsAddSourceModalOpen(true)}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[11px] rounded-lg border border-blue-200 transition-all flex items-center gap-1 cursor-pointer"
                  title="Adicionar novas fontes (PDF, Web, YouTube, Google Docs)"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-700" />
                  <span>Adicionar Fonte</span>
                </button>
              )}
            </div>

            {/* Select/Deselect all sources filter */}
            {documents.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>Marque as fontes ativas no chat:</span>
                <button
                  type="button"
                  onClick={handleSelectAllDocs}
                  className="text-blue-700 hover:text-blue-900 font-bold cursor-pointer"
                >
                  {selectedDocIds.length === documents.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                </button>
              </div>
            )}

            {documents.length === 0 ? (
              <div className="text-center py-6 px-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <FileQuestion className="w-7 h-7 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-slate-700">Nenhuma fonte cadastrada</div>
                <p className="text-[11px] text-slate-500">
                  Adicione PDFs, sites, vídeos do YouTube ou Google Docs para a IA consultar.
                </p>
                {canManageDocs && (
                  <button
                    type="button"
                    onClick={() => setIsAddSourceModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1 cursor-pointer mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Primeira Fonte</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {documents.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      className={`p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between gap-2 ${
                        isSelected 
                          ? 'bg-blue-50/60 border-blue-300 text-slate-900' 
                          : 'bg-slate-50/60 border-slate-200 text-slate-500 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleDoc(doc.id)}
                          className="text-blue-700 hover:text-blue-900 cursor-pointer shrink-0"
                          title={isSelected ? 'Desmarcar fonte' : 'Ativar fonte para o chat'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-700" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {getSourceIcon(doc.tipo)}

                        <div className="truncate min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setViewingSourceDoc(doc)}
                            className="font-bold text-slate-900 hover:text-blue-700 block truncate text-left cursor-pointer"
                            title="Clique para visualizar conteúdo extraído desta fonte"
                          >
                            {doc.nome}
                          </button>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <span className="uppercase font-extrabold">{doc.tipo}</span>
                            {doc.total_chunks ? `• ${doc.total_chunks} blocos vetoriais` : `• ${doc.tamanho || 'Ativo'}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewingSourceDoc(doc)}
                          className="p-1 text-slate-400 hover:text-blue-700 rounded-md"
                          title="Visualizar detalhes da fonte"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        {canManageDocs && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id, doc.nome)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                            title="Excluir fonte da base"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card: Histórico de Conversas (ChatGPT style) */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-blue-700" />
                <span>Histórico ({conversations.length})</span>
              </span>

              <button
                type="button"
                onClick={handleStartNewChat}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-lg border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                title="Iniciar uma nova conversa limpa (as anteriores ficam salvas aqui)"
              >
                <Plus className="w-3.5 h-3.5 text-slate-700" />
                <span>Novo Chat</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {conversations.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500">
                  Nenhuma conversa registrada.
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveConversation(c);
                      inputRef.current?.focus();
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                      activeConversation.id === c.id
                        ? 'bg-blue-50/80 border-blue-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="truncate pr-2 flex-1 min-w-0">
                      <span className="font-bold text-slate-900 block truncate">{c.titulo}</span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(c.atualizado_em).toLocaleDateString('pt-BR')}</span>
                        <span>• {c.mensagens.length} msgs</span>
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ============================================================================== */}
        {/* RIGHT COLUMN: Chat Always Live & Continuous (NotebookLM / GPT style) */}
        {/* ============================================================================== */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-xs border border-slate-200/90 flex flex-col h-[650px] overflow-hidden">
          
          {/* Chat Header */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-black text-xs sm:text-sm text-slate-100 truncate max-w-xs sm:max-w-md">
                  {activeConversation.titulo}
                </h3>
                <span className="text-[11px] text-blue-300 flex items-center gap-1">
                  <span>{selectedDocIds.length} fontes ativas selecionadas</span>
                  <span>• Catálogo oficial sincronizado</span>
                </span>
              </div>
            </div>

            {/* Clear/Restart conversation */}
            <button
              type="button"
              onClick={handleStartNewChat}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title="Iniciar nova conversa limpa"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Novo Tópico</span>
            </button>
          </div>

          {/* Quick Prompts Chips */}
          <div className="bg-slate-50/90 border-b border-slate-200/80 p-2 overflow-x-auto flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-black uppercase text-slate-400 pl-1 shrink-0">Sugestões:</span>
            {[
              'Compare os produtos do catálogo',
              'Quais produtos têm embalagem de 20L?',
              'Qual a diferença entre 15W40 e 5W30?',
              'Resuma as especificações técnicas da base',
            ].map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(undefined, suggestion)}
                disabled={isGenerating}
                className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[11px] font-semibold text-slate-700 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/40">
            {activeConversation.mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-700 text-white flex items-center justify-center shrink-0 font-black text-xs shadow-xs">
                    IA
                  </div>
                )}

                <div
                  className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-4 text-xs leading-relaxed space-y-3 shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-blue-700 text-white rounded-br-none font-medium'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-none'
                  }`}
                >
                  {/* Message content with interactive citation numbers [1], [2] */}
                  {msg.sender === 'ai' 
                    ? renderMessageWithCitations(msg.text, msg.citations)
                    : <div className="whitespace-pre-wrap">{msg.text}</div>
                  }

                  {/* NotebookLM Citations Footnote Drawer */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Fontes Ancoradas ({msg.citations.length}):</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((c) => (
                          <button
                            key={c.index}
                            type="button"
                            onClick={() => setActiveCitationForModal(c)}
                            className="bg-blue-50/80 hover:bg-blue-100 text-blue-900 border border-blue-200/80 px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer text-left"
                            title={`Clique para ver o trecho exato citado de "${c.document_name}"`}
                          >
                            <span className="w-4 h-4 rounded-full bg-blue-700 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                              {c.index}
                            </span>
                            <span className="truncate max-w-[140px] sm:max-w-[200px]">{c.document_name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-xs">
                    {currentUser.nome.charAt(0)}
                  </div>
                )}
              </div>
            ))}

            {isGenerating && (
              <div className="flex items-center gap-3 text-xs text-blue-800 bg-blue-50 p-3 rounded-2xl border border-blue-200 w-fit shadow-xs animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-blue-700 shrink-0" />
                <span className="font-bold">Consultando vetores e ancorando resposta nos documentos...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Continuous Chat Input Form (Always Available & Accessible) */}
          <form
            onSubmit={(e) => handleSendMessage(e)}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Faça uma pergunta sobre seus materiais ou peça para comparar produtos..."
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              disabled={isGenerating}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isGenerating}
              className="px-5 py-3 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-50 text-white rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer font-bold text-xs"
              title="Enviar mensagem para o Especialista"
            >
              <span>Enviar</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* MODAL 1: ADD SOURCE MODAL (NOTEBOOKLM STYLE: Local Files, Web, YouTube, Docs)  */}
      {/* ============================================================================== */}
      {isAddSourceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm sm:text-base">
                    Adicionar Fonte de Conhecimento
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    O material será limpo, fatiado em blocos com embeddings para consulta estrita da IA.
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => !isIngesting && setIsAddSourceModalOpen(false)} 
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Source Type Navigation Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setSourceTab('local')}
                className={`py-2 text-[11px] font-extrabold rounded-lg transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  sourceTab === 'local' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Arquivos</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceTab('web')}
                className={`py-2 text-[11px] font-extrabold rounded-lg transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  sourceTab === 'web' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Web / Site</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceTab('youtube')}
                className={`py-2 text-[11px] font-extrabold rounded-lg transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  sourceTab === 'youtube' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Youtube className="w-3.5 h-3.5" />
                <span>YouTube</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceTab('gdocs')}
                className={`py-2 text-[11px] font-extrabold rounded-lg transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  sourceTab === 'gdocs' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Docs/Slides</span>
              </button>
            </div>

            {/* TAB 1: LOCAL FILES (PDF, TXT, MD) */}
            {sourceTab === 'local' && (
              <div className="space-y-4 pt-2">
                <div 
                  onClick={() => !isIngesting && fileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/70 p-6 rounded-2xl text-center cursor-pointer transition-all space-y-2"
                >
                  <FileUp className="w-8 h-8 text-blue-600 mx-auto" />
                  <div className="font-bold text-xs text-blue-900">
                    Clique aqui ou selecione arquivos do computador
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Formatos suportados: <strong>PDF</strong>, <strong>Texto (.txt)</strong> e <strong>Markdown (.md)</strong>.
                    <br />Você pode selecionar múltiplos arquivos simultaneamente.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: WEB URL */}
            {sourceTab === 'web' && (
              <form onSubmit={handleIngestExternalSource} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    URL do Site Público
                  </label>
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://exemplo.com.br/ficha-tecnica"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white"
                    required
                    disabled={isIngesting}
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    A IA acessará a página, removerá menus/propagandas e extrairá o texto limpo para embeddings.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Nome de Identificação (Opcional)
                  </label>
                  <input
                    type="text"
                    value={webTitle}
                    onChange={(e) => setWebTitle(e.target.value)}
                    placeholder="Ex: Ficha Oficial Lubrax Top Turbo Web"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    disabled={isIngesting}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddSourceModalOpen(false)}
                    className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
                    disabled={isIngesting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!webUrl.trim() || isIngesting}
                    className="px-5 py-2 bg-blue-700 text-white rounded-xl text-xs font-bold hover:bg-blue-800 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isIngesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Indexar Site</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: YOUTUBE VIDEO */}
            {sourceTab === 'youtube' && (
              <form onSubmit={handleIngestExternalSource} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Link do Vídeo do YouTube
                  </label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white"
                    required
                    disabled={isIngesting}
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Extrai automaticamente as legendas, transcrição e metadados técnicos do vídeo.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Título do Vídeo (Opcional)
                  </label>
                  <input
                    type="text"
                    value={youtubeTitle}
                    onChange={(e) => setYoutubeTitle(e.target.value)}
                    placeholder="Ex: Treinamento Técnico Lubrificantes Diesel"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    disabled={isIngesting}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddSourceModalOpen(false)}
                    className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
                    disabled={isIngesting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!youtubeUrl.trim() || isIngesting}
                    className="px-5 py-2 bg-rose-700 text-white rounded-xl text-xs font-bold hover:bg-rose-800 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isIngesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Indexar Vídeo</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: GOOGLE DOCS / GOOGLE SLIDES */}
            {sourceTab === 'gdocs' && (
              <form onSubmit={handleIngestExternalSource} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Link do Google Docs ou Google Slides
                  </label>
                  <input
                    type="url"
                    value={gdocsUrl}
                    onChange={(e) => setGdocsUrl(e.target.value)}
                    placeholder="https://docs.google.com/document/d/... ou /presentation/d/..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white"
                    required
                    disabled={isIngesting}
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Certifique-se de que o documento esteja com acesso de leitura ('Qualquer pessoa com o link').
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Nome da Apresentação / Documento (Opcional)
                  </label>
                  <input
                    type="text"
                    value={gdocsTitle}
                    onChange={(e) => setGdocsTitle(e.target.value)}
                    placeholder="Ex: Treinamento Linha Lubrax 2026"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    disabled={isIngesting}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddSourceModalOpen(false)}
                    className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
                    disabled={isIngesting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!gdocsUrl.trim() || isIngesting}
                    className="px-5 py-2 bg-blue-700 text-white rounded-xl text-xs font-bold hover:bg-blue-800 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isIngesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Indexar Google Doc</span>
                  </button>
                </div>
              </form>
            )}

            {/* Ingestion Feedback Overlay */}
            {isIngesting && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-700 shrink-0" />
                <span className="font-bold">{ingestFeedback || 'Processando dados da fonte...'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 2: CITATION INSPECTION DRAWER (NotebookLM Click-to-View Source Snippet)  */}
      {/* ============================================================================== */}
      {activeCitationForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center font-black text-xs shrink-0">
                  {activeCitationForModal.index}
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    Trecho Citado da Fonte Original
                  </h3>
                  <span className="text-[11px] text-slate-500 font-semibold truncate block max-w-xs">
                    {activeCitationForModal.document_name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveCitationForModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Original Snippet with visual highlight */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-xs text-slate-900 font-mono leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
              {activeCitationForModal.snippet}
            </div>

            <div className="flex items-center justify-between pt-2">
              {activeCitationForModal.source_url ? (
                <a
                  href={activeCitationForModal.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-700 hover:text-blue-900 font-bold inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Link da Fonte</span>
                </a>
              ) : (
                <span className="text-[11px] text-slate-400">Fonte interna do Workspace</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activeCitationForModal.snippet);
                    setCopiedCitationSnippet(true);
                    setTimeout(() => setCopiedCitationSnippet(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedCitationSnippet ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Trecho</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCitationForModal(null)}
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 3: VIEW SOURCE DETAILS / EXTRACTED CONTENT                              */}
      {/* ============================================================================== */}
      {viewingSourceDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 truncate">
                {getSourceIcon(viewingSourceDoc.tipo)}
                <div className="truncate">
                  <h3 className="font-black text-slate-900 text-sm truncate">
                    {viewingSourceDoc.nome}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Tipo: {viewingSourceDoc.tipo.toUpperCase()} • Indexado por {viewingSourceDoc.autor_nome}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingSourceDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700">Prévia do Conteúdo Extraído:</span>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-mono leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                {viewingSourceDoc.conteudo_extraido || 'Conteúdo vetorial indexado no banco de dados.'}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {viewingSourceDoc.fonte_url ? (
                <a
                  href={viewingSourceDoc.fonte_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-700 hover:text-blue-900 font-bold inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Acessar URL da Fonte</span>
                </a>
              ) : (
                <span className="text-[11px] text-slate-400">Documento importado localmente</span>
              )}

              <button
                type="button"
                onClick={() => setViewingSourceDoc(null)}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
