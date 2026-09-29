import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Image as ImageIcon, 
  Paperclip, 
  X, 
  Edit3, 
  Share2, 
  Calendar, 
  User as UserIcon,
  Sparkles,
  Upload,
  Camera,
  FileUp,
  ImagePlus,
  Link as LinkIcon,
  Loader2,
  Send,
  MessageSquare,
  Check,
  Building2,
  Pin,
  Globe,
  Filter
} from 'lucide-react';
import { FeedPost, User, Workspace } from '../types';
import { StorageService } from '../lib/storage';
import { formatDateTime } from '../lib/pdfPngGenerator';
import {
  supabase,
  getFeedPostsFromSupabase,
  insertFeedPostToSupabase,
  updateFeedPostReactionInSupabase,
  deleteFeedPostFromSupabase,
} from '../lib/supabaseClient';

interface FeedModuleProps {
  currentUser: User;
  workspaceId: string;
}

export const FeedModule: React.FC<FeedModuleProps> = ({ currentUser, workspaceId }) => {
  const isDiretor = currentUser.role === 'diretor';
  const [showAllBranches, setShowAllBranches] = useState<boolean>(false);
  const [posts, setPosts] = useState<FeedPost[]>(() => StorageService.getFeedPosts(workspaceId, currentUser));
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>(() => StorageService.getWorkspaces());
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [postToDelete, setPostToDelete] = useState<FeedPost | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(false);

  // New Post Form State
  const [legenda, setLegenda] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [fileInputName, setFileInputName] = useState('');
  const [fileInputUrl, setFileInputUrl] = useState('');
  const [filesList, setFilesList] = useState<{ nome: string; url: string; tamanho?: string }[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [targetWsIds, setTargetWsIds] = useState<string[]>(['ALL']);

  // File Upload State & Refs
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fetchFeedFromSupabase = async () => {
    setIsLoadingFeed(true);
    try {
      const activeWs = isDiretor && showAllBranches ? 'ALL' : workspaceId;
      const data = await getFeedPostsFromSupabase(activeWs, currentUser);
      if (data) setPosts(data);
    } catch (err) {
      console.warn('Erro ao carregar feed do Supabase:', err);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  useEffect(() => {
    fetchFeedFromSupabase();
    setAllWorkspaces(StorageService.getWorkspaces());

    // Inscrição em tempo real para o feed no Supabase
    const channel = supabase
      .channel(`realtime-feed-${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts' }, () => {
        const activeWs = isDiretor && showAllBranches ? 'ALL' : workspaceId;
        getFeedPostsFromSupabase(activeWs, currentUser).then(setPosts);
      })
      .subscribe();

    const handleUpdate = () => {
      fetchFeedFromSupabase();
      setAllWorkspaces(StorageService.getWorkspaces());
    };
    window.addEventListener('smartvisit_feed_updated', handleUpdate);
    window.addEventListener('smartvisit_workspaces_updated', handleUpdate);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('smartvisit_feed_updated', handleUpdate);
      window.removeEventListener('smartvisit_workspaces_updated', handleUpdate);
    };
  }, [workspaceId, currentUser, showAllBranches, isDiretor]);

  // Format File Size Helper
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Compress Image to prevent localStorage QuotaExceeded errors
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      // If SVG or gif, read directly
      if (file.type.includes('svg') || file.type.includes('gif')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve((readerEvent.target?.result as string) || '');
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressed);
        };
        img.onerror = () => resolve((readerEvent.target?.result as string) || '');
        img.src = readerEvent.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Device Image Reader (PC or Mobile Camera/Gallery)
  const processImageFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    setIsUploadingImage(true);
    try {
      const results = await Promise.all(fileArray.map(f => compressImageFile(f)));
      const validImages = results.filter(r => !!r);
      if (validImages.length > 0) {
        setImageUrls(prev => [...prev, ...validImages]);
      }
    } catch (err) {
      console.error('Error processing images:', err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDeviceImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFiles(e.target.files);
      e.target.value = '';
    }
  };

  // Device Attachment File Reader (PDF, Docs, Excel, etc.)
  const processDocFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploadingDoc(true);
    let loadedCount = 0;
    const newFiles: { nome: string; url: string; tamanho?: string }[] = [];

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          newFiles.push({
            nome: file.name,
            url: e.target.result as string,
            tamanho: formatFileSize(file.size)
          });
        }
        loadedCount++;
        if (loadedCount === fileArray.length) {
          setFilesList(prev => [...prev, ...newFiles]);
          setIsUploadingDoc(false);
        }
      };
      reader.onerror = () => {
        loadedCount++;
        if (loadedCount === fileArray.length) setIsUploadingDoc(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeviceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processDocFiles(e.target.files);
      e.target.value = '';
    }
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      const images = files.filter(f => f.type.startsWith('image/'));
      const docs = files.filter(f => !f.type.startsWith('image/'));
      if (images.length > 0) processImageFiles(images);
      if (docs.length > 0) processDocFiles(docs);
    }
  };

  const userRole = (currentUser?.role || '').toLowerCase();
  const isDiretorUser = userRole === 'diretor';
  const isGestorUser = userRole === 'gestor' || userRole === 'gerente';
  const isVendedorUser = userRole === 'vendedor';

  const canManage = isDiretorUser || isGestorUser;
  const canPost = isDiretorUser || isGestorUser; // Vendedores não podem publicar no feed, apenas visualizar, reagir e baixar
  const canEditOrDelete = (post: FeedPost) => {
    if (isDiretorUser) return true;
    if (isGestorUser) {
      return (
        post.workspace_id === currentUser.workspace_id ||
        post.filialId === currentUser.filialId ||
        post.autor_id === currentUser.id
      );
    }
    return false; // Vendedor cannot edit or delete posts
  };

  const REACTION_EMOJIS = [
    { emoji: '❤️', label: 'Coração' },
    { emoji: '👏', label: 'Palmas' },
    { emoji: '🚀', label: 'Foguete' },
    { emoji: '😄', label: 'Alegre' },
    { emoji: '😢', label: 'Triste' },
    { emoji: '🙏', label: 'Gratidão/Amém' },
    { emoji: '👍', label: 'Legal' },
  ];

  const handleToggleReaction = (post: FeedPost, emojiStr: string) => {
    const existingReactions = post.reacoes || [];
    const userInfo = { id: currentUser.id, nome: currentUser.nome };

    // Check if user already had this exact emoji
    const currentEmojiReaction = existingReactions.find(r => r.emoji === emojiStr);
    const alreadyHasThisEmoji = currentEmojiReaction?.usuarios?.some(
      u => u.id === currentUser.id || u.nome === currentUser.nome
    );

    // 1. Remove user from ALL emoji reactions
    let cleanedReactions = existingReactions
      .map(r => ({
        ...r,
        usuarios: (r.usuarios || []).filter(
          u => u.id !== currentUser.id && u.nome !== currentUser.nome
        )
      }))
      .filter(r => r.usuarios.length > 0);

    // 2. If user didn't have this emoji, add it
    if (!alreadyHasThisEmoji) {
      const idx = cleanedReactions.findIndex(r => r.emoji === emojiStr);
      if (idx >= 0) {
        cleanedReactions[idx].usuarios.push(userInfo);
      } else {
        cleanedReactions.push({
          emoji: emojiStr,
          usuarios: [userInfo]
        });
      }
    }

    const updatedPost = { ...post, reacoes: cleanedReactions };
    updateFeedPostReactionInSupabase(post.id, cleanedReactions).catch(err => {
      console.warn('Erro ao sincronizar reação no Supabase:', err);
    });
    StorageService.saveFeedPost(updatedPost);
    setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
  };

  const handleRefresh = async () => {
    await fetchFeedFromSupabase();
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    setImageUrls([...imageUrls, imageUrlInput.trim()]);
    setImageUrlInput('');
  };

  const handleRemoveImageUrl = (idx: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== idx));
  };

  const handleAddFile = () => {
    if (!fileInputName.trim() || !fileInputUrl.trim()) return;
    setFilesList([...filesList, { nome: fileInputName.trim(), url: fileInputUrl.trim(), tamanho: '1.5 MB' }]);
    setFileInputName('');
    setFileInputUrl('');
  };

  const handleRemoveFile = (idx: number) => {
    setFilesList(filesList.filter((_, i) => i !== idx));
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLegenda = legenda.trim();
    if (!cleanLegenda && imageUrls.length === 0 && filesList.length === 0) return;

    // Determine target workspaces
    const finalTargetWsIds = currentUser.role === 'diretor'
      ? (targetWsIds && targetWsIds.length > 0 ? targetWsIds : ['ALL'])
      : [currentUser.workspace_id || workspaceId];

    const primaryWorkspaceId = finalTargetWsIds.includes('ALL')
      ? (currentUser.workspace_id || workspaceId)
      : (finalTargetWsIds[0] || workspaceId);

    if (editingPost) {
      const updated: FeedPost = {
        ...editingPost,
        legenda: cleanLegenda,
        imagens: imageUrls,
        arquivos: filesList,
        target_workspace_ids: finalTargetWsIds,
        workspace_id: primaryWorkspaceId,
        filialId: primaryWorkspaceId,
        autor_avatar_url: currentUser.avatar_url || editingPost.autor_avatar_url,
      };

      try {
        await insertFeedPostToSupabase(updated);
      } catch (err: any) {
        console.error('Erro ao atualizar post no Supabase:', err);
      }

      StorageService.saveFeedPost(updated);
      setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
      StorageService.logAudit(
        workspaceId,
        currentUser.nome,
        `Editou publicação do feed: "${cleanLegenda.slice(0, 35)}..."`,
        'Feed',
        `ID: ${editingPost.id}`,
        'edicao',
        currentUser.role
      );
    } else {
      const newPost: FeedPost = {
        id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        workspace_id: primaryWorkspaceId,
        filialId: primaryWorkspaceId,
        autor_id: currentUser.id,
        autor_nome: currentUser.nome,
        autor_role: currentUser.role,
        autor_avatar_url: currentUser.avatar_url,
        target_workspace_ids: finalTargetWsIds,
        data: new Date().toISOString(),
        legenda: cleanLegenda,
        imagens: imageUrls,
        arquivos: filesList,
        reacoes: [],
      };

      try {
        await insertFeedPostToSupabase(newPost);
      } catch (err: any) {
        console.error('Erro ao inserir post no Supabase:', err);
      }

      StorageService.saveFeedPost(newPost);
      setPosts(prev => [newPost, ...prev]);
      
      StorageService.logAudit(
        workspaceId,
        currentUser.nome,
        `Publicou nova mensagem no Mural Interno`,
        'Feed',
        `Conteúdo: "${cleanLegenda.slice(0, 50)}..."`,
        'criacao',
        currentUser.role
      );

      // Notification for Gerentes and Diretores
      StorageService.addNotification({
        workspace_id: workspaceId,
        titulo: 'Novo Post no Feed',
        mensagem: `${currentUser.nome} publicou no Mural: "${(cleanLegenda || 'Nova foto/anexo').slice(0, 60)}..."`,
        tipo: 'feed',
        target_roles: ['gestor', 'gerente', 'diretor'],
        link_tab: 'feed',
        entidade_id: newPost.id,
      });
    }

    // Reset Form
    setLegenda('');
    setImageUrls([]);
    setFilesList([]);
    setImageUrlInput('');
    setShowUrlInput(false);
    setTargetWsIds(['ALL']);
    setEditingPost(null);
    setIsNewPostModalOpen(false);
  };

  const handleEditClick = (post: FeedPost) => {
    setEditingPost(post);
    setLegenda(post.legenda);
    setImageUrls(post.imagens || []);
    setFilesList(post.arquivos || []);
    setTargetWsIds(post.target_workspace_ids && post.target_workspace_ids.length > 0 ? post.target_workspace_ids : ['ALL']);
    setIsNewPostModalOpen(true);
  };

  const handleDeleteClick = async (postId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta publicação?')) {
      try {
        await deleteFeedPostFromSupabase(postId);
      } catch (err: any) {
        console.error('Erro ao deletar post no Supabase:', err);
      }
      StorageService.deleteFeedPost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      StorageService.logAudit(
        workspaceId,
        currentUser.nome,
        `Excluiu publicação do Mural Interno`,
        'Feed',
        `ID: ${postId}`,
        'exclusao',
        currentUser.role
      );
    }
  };

  const handleDownloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'imagem_feed_smartvisit.jpg';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const activeWorkspaceObj = allWorkspaces.find(w => w.id === workspaceId);

  return (
    <div className="space-y-4 pb-20">
      {/* Discreet All Branches toggle for Diretor */}
      {isDiretor && (
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 px-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium truncate">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              Filial: <strong className="text-slate-800">{activeWorkspaceObj?.nome || 'Filial Selecionada'}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAllBranches(prev => !prev)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 border shadow-2xs shrink-0 cursor-pointer ${
              showAllBranches
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
            }`}
            title={showAllBranches ? "Clique para voltar a exibir apenas a filial selecionada no menu superior" : "Clique para visualizar publicações de todas as filiais"}
          >
            <Globe className={`w-3 h-3 ${showAllBranches ? 'text-white' : 'text-blue-600'}`} />
            <span>{showAllBranches ? 'Vendo Todas as Filiais' : 'Ver Todas as Filiais'}</span>
          </button>
        </div>
      )}

      {/* Feed List */}
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Twitter / X Style Inline Quick Composer Card (Hidden for Vendedor) */}
        {canPost && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/90 space-y-3 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10">
          <form onSubmit={handleSavePost} className="space-y-3">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs overflow-hidden">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt={currentUser.nome} className="w-full h-full object-cover" />
                ) : (
                  currentUser.nome.charAt(0)
                )}
              </div>
              <div className="grow space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    {currentUser.nome}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Publicação em texto, fotos ou arquivos</span>
                </div>
                <textarea
                  value={legenda}
                  onChange={(e) => setLegenda(e.target.value)}
                  placeholder="O que está acontecendo? Escreva uma publicação ou atualização de preço..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all resize-none"
                />
              </div>
            </div>

            {/* Target Branch Selection for Diretor */}
            {currentUser.role === 'diretor' && (
              <div className="sm:pl-13 bg-purple-50/80 p-3 rounded-xl border border-purple-200/80 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-purple-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <Building2 className="w-3.5 h-3.5 text-purple-700" />
                    <span>Selecione a Visibilidade por Filial:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setTargetWsIds(targetWsIds.includes('ALL') ? [workspaceId] : ['ALL'])}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                      targetWsIds.includes('ALL')
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'bg-white text-purple-800 border border-purple-300 hover:bg-purple-100'
                    }`}
                  >
                    {targetWsIds.includes('ALL') ? '✓ Todas as Filiais Marcadas' : 'Marcar Todas as Filiais'}
                  </button>
                </div>

                {!targetWsIds.includes('ALL') && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {allWorkspaces.map((ws) => {
                      const isChecked = targetWsIds.includes(ws.id);
                      return (
                        <button
                          key={ws.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              const next = targetWsIds.filter(id => id !== ws.id);
                              setTargetWsIds(next.length === 0 ? [workspaceId] : next);
                            } else {
                              setTargetWsIds([...targetWsIds.filter(id => id !== 'ALL'), ws.id]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg font-medium text-xs border transition-all flex items-center gap-1.5 ${
                            isChecked
                              ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                          <span>{ws.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Attached Images Preview */}
            {imageUrls.length > 0 && (
              <div className="sm:pl-13 flex flex-wrap gap-2">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                    <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImageUrl(idx)}
                      className="absolute top-1 right-1 p-1 bg-slate-900/80 hover:bg-red-600 text-white rounded-full transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Attached Docs Preview */}
            {filesList.length > 0 && (
              <div className="sm:pl-13 flex flex-wrap gap-2">
                {filesList.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium text-slate-700">
                    <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                    <span className="truncate max-w-[150px]">{file.nome}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-slate-400 hover:text-red-600 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden File Inputs for Device Upload */}
            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleDeviceImageSelect}
              className="hidden"
            />
            <input
              ref={docFileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              multiple
              onChange={handleDeviceFileSelect}
              className="hidden"
            />

            {/* Composition Action Bar */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 sm:pl-13">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => imageFileInputRef.current?.click()}
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                  title="Anexar imagem do computador"
                >
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span className="hidden sm:inline">Imagem</span>
                </button>

                <button
                  type="button"
                  onClick={() => docFileInputRef.current?.click()}
                  className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                  title="Anexar documento ou tabela"
                >
                  <Paperclip className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Documento</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                  {legenda.length} caract.
                </span>
                <button
                  type="submit"
                  disabled={!legenda.trim() && imageUrls.length === 0 && filesList.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publicar</span>
                </button>
              </div>
            </div>
          </form>
        </div>
        )}

        {posts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">Nenhuma publicação no feed ainda.</p>
            <p className="text-xs text-slate-500 mt-1">
              Os avisos e comunicações da empresa aparecerão aqui.
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <article
              key={post.id}
              className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden transition-all hover:shadow-md"
            >
              {/* Post Header */}
              <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 overflow-hidden uppercase">
                    <span>{post.autor_nome ? post.autor_nome.charAt(0) : 'U'}</span>
                    {post.autor_avatar_url && (
                      <img
                        src={post.autor_avatar_url}
                        alt={post.autor_nome}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 block leading-tight">
                      {post.autor_nome}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {post.fixado && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-xs">
                          <Pin className="w-3 h-3 text-amber-700 fill-amber-700" />
                          <span>FIXADO</span>
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(post.data)}
                      </span>
                      {post.target_workspace_ids && post.target_workspace_ids.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {post.target_workspace_ids.includes('ALL')
                            ? '📍 Visível em Todas as Filiais'
                            : `📍 Filial: ${post.target_workspace_ids.map(id => allWorkspaces.find(w => w.id === id)?.nome || id).join(', ')}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {(currentUser.role === 'gerente' || currentUser.role === 'diretor') && (
                    <button
                      onClick={() => {
                        StorageService.togglePinFeedPost(post.id);
                        handleRefresh();
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        post.fixado
                          ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300'
                          : 'text-slate-400 hover:text-amber-600 hover:bg-slate-50'
                      }`}
                      title={post.fixado ? 'Desafixar publicação do topo' : 'Fixar publicação no topo do feed'}
                    >
                      <Pin className={`w-4 h-4 ${post.fixado ? 'fill-amber-600' : ''}`} />
                    </button>
                  )}

                  {canEditOrDelete(post) && (
                    <>
                      <button
                        onClick={() => handleEditClick(post)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors"
                        title="Editar Post"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPostToDelete(post)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir Post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Post Caption / Text */}
              <div className="p-4 sm:p-5 text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                {post.legenda}
              </div>

              {/* Post Image Gallery */}
              {post.imagens && post.imagens.length > 0 && (
                <div className={`grid gap-3 p-3 bg-slate-50 border-t border-slate-100 ${post.imagens.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {post.imagens.map((imgUrl, idx) => (
                    <div key={idx} className="rounded-xl bg-white border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
                      <div className="w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                        <img
                          src={imgUrl}
                          alt={`Imagem ${idx + 1}`}
                          className="w-full h-auto max-h-[440px] object-cover"
                        />
                      </div>
                      
                      {/* Button located below the image to guarantee unobstructed view */}
                      <div className="px-3 py-2 bg-white flex items-center justify-end border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleDownloadImage(imgUrl, `SmartVisit_Post_Img_${idx + 1}.jpg`)}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Baixar imagem"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                          <span>Baixar Imagem</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Post Attached Files */}
              {post.arquivos && post.arquivos.length > 0 && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Arquivos em Anexo ({post.arquivos.length})
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {post.arquivos.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-xs transition-all text-xs font-semibold text-slate-800"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="truncate">{file.nome}</span>
                        </div>
                        <Download className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {/* Reactions Bar */}
              <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {REACTION_EMOJIS.map(({ emoji, label }) => {
                    const reactionObj = (post.reacoes || []).find(r => r.emoji === emoji);
                    const userReacted = reactionObj?.usuarios?.some(u => u.id === currentUser.id || u.nome === currentUser.nome);
                    const count = reactionObj?.usuarios?.length || 0;

                    return (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(post, emoji)}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                          userReacted
                            ? 'bg-blue-100 text-blue-900 border-blue-300 scale-105 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={`${label} (${count})`}
                      >
                        <span className="text-sm">{emoji}</span>
                        {count > 0 && <span className="text-[11px] font-extrabold">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                {post.reacoes && post.reacoes.length > 0 && (() => {
                  const allUsers = post.reacoes.flatMap(r => r.usuarios);
                  const total = allUsers.length;
                  if (total === 0) return null;
                  const names = allUsers.slice(0, 3).map(u => u.nome).join(', ');
                  const suffix = total > 3 ? ` e outros (${total})` : '';
                  const verb = total === 1 ? 'reagiu' : 'reagiram';
                  return (
                    <div className="text-[11px] text-slate-500 font-medium truncate max-w-[280px]">
                      {names}{suffix} {verb}
                    </div>
                  );
                })()}
              </div>
            </article>
          ))
        )}
      </div>

      {/* New / Edit Post Modal */}
      {isNewPostModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                {editingPost ? 'Editar Publicação' : 'Nova Publicação no Feed'}
              </h3>
              <button
                onClick={() => setIsNewPostModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePost} className="space-y-4">
              {/* Branch Selector for Diretor */}
              {currentUser.role === 'diretor' && (
                <div className="bg-purple-50/80 p-3 rounded-xl border border-purple-200/80 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-purple-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                      <Building2 className="w-3.5 h-3.5 text-purple-700" />
                      <span>Destino da Publicação (Filiais):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTargetWsIds(targetWsIds.includes('ALL') ? [workspaceId] : ['ALL'])}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                        targetWsIds.includes('ALL')
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'bg-white text-purple-800 border border-purple-300 hover:bg-purple-100'
                      }`}
                    >
                      {targetWsIds.includes('ALL') ? '✓ Todas as Filiais Marcadas' : 'Marcar Todas as Filiais'}
                    </button>
                  </div>

                  {!targetWsIds.includes('ALL') && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {allWorkspaces.map((ws) => {
                        const isChecked = targetWsIds.includes(ws.id);
                        return (
                          <button
                            key={ws.id}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                const next = targetWsIds.filter(id => id !== ws.id);
                                setTargetWsIds(next.length === 0 ? [workspaceId] : next);
                              } else {
                                setTargetWsIds([...targetWsIds.filter(id => id !== 'ALL'), ws.id]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg font-medium text-xs border transition-all flex items-center gap-1.5 ${
                              isChecked
                                ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                            <span>{ws.nome}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Legenda / Texto da Mensagem
                </label>
                <textarea
                  rows={4}
                  value={legenda}
                  onChange={(e) => setLegenda(e.target.value)}
                  placeholder="Escreva novidades, anúncios comerciais ou orientações..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Hidden File Inputs for PC/Mobile Devices */}
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleDeviceImageSelect}
                className="hidden"
              />
              <input
                ref={docFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,image/*"
                multiple
                onChange={handleDeviceFileSelect}
                className="hidden"
              />

              {/* Add Image Section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Imagens da Publicação (PC / Celular)
                </label>

                {/* Drag and Drop / Device Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`p-4 rounded-xl border-2 border-dashed transition-all text-center cursor-pointer ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/60'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 hover:border-blue-300'
                  }`}
                  onClick={() => imageFileInputRef.current?.click()}
                >
                  {isUploadingImage ? (
                    <div className="flex flex-col items-center py-2 text-blue-600">
                      <Loader2 className="w-6 h-6 animate-spin mb-1" />
                      <span className="text-xs font-bold">Processando imagem...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-center gap-2">
                        <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="p-2.5 bg-slate-800 text-white rounded-xl shadow-xs">
                          <Camera className="w-5 h-5" />
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Clique aqui para escolher foto do seu Computador ou Celular
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Suporta arquivos JPG, PNG, WEBP ou fotos direto da câmera móvel
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Alternative: Link Input Toggle */}
                <div className="pt-1">
                  {!showUrlInput ? (
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(true)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>Ou colar link/URL de imagem da web</span>
                    </button>
                  ) : (
                    <div className="flex gap-2 mt-1">
                      <input
                        type="url"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="https://exemplo.com/imagem.jpg"
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={handleAddImageUrl}
                        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900"
                      >
                        Adicionar
                      </button>
                    </div>
                  )}
                </div>

                {/* Image Previews */}
                {imageUrls.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Imagens selecionadas ({imageUrls.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {imageUrls.map((url, i) => (
                        <div key={i} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                          <img src={url} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImageUrl(i)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow-sm hover:scale-110 transition-transform"
                            title="Remover imagem"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Add Attached Files Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Anexar Arquivos (PDF, Excel, Word do Aparelho)
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => docFileInputRef.current?.click()}
                    disabled={isUploadingDoc}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isUploadingDoc ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <FileUp className="w-4 h-4 text-blue-600" />
                    )}
                    <span>Importar Arquivo do PC / Celular</span>
                  </button>
                </div>

                {/* Selected Files List */}
                {filesList.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {filesList.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-medium text-slate-800 truncate">{f.nome}</span>
                          {f.tamanho && (
                            <span className="text-[10px] text-slate-400 shrink-0">({f.tamanho})</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(i)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                          title="Remover anexo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewPostModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-700 text-white rounded-xl text-xs font-bold hover:bg-blue-800 shadow-md shadow-blue-700/20"
                >
                  Publicar no Feed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Post */}
      {postToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full text-red-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir Publicação</h3>
                <p className="text-xs text-slate-500">Mural Interno & Feed</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              Tem certeza que deseja excluir esta publicação? O conteúdo e todas as imagens/anexos serão removidos do mural do workspace.
            </p>

            {postToDelete.legenda && (
              <div className="text-[11px] text-slate-600 italic bg-slate-100/70 p-2.5 rounded-lg border border-slate-200/60 line-clamp-2">
                "{postToDelete.legenda}"
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPostToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  StorageService.deleteFeedPost(postToDelete.id);
                  StorageService.logAudit(
                    workspaceId,
                    currentUser.nome,
                    `Excluiu publicação do Mural Interno`,
                    'Feed',
                    `ID: ${postToDelete.id} | Conteúdo: "${postToDelete.legenda.slice(0, 40)}..."`,
                    'exclusao',
                    currentUser.role
                  );
                  handleRefresh();
                  setPostToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
