import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  FileText, 
  Download, 
  Share2, 
  Copy,
  CheckCircle2, 
  Clock, 
  Building, 
  Package, 
  Calculator, 
  X, 
  Eye, 
  MessageSquare,
  Sparkles,
  ChevronRight,
  Edit3,
  Edit2,
  Check,
  AlertCircle,
  AlertTriangle,
  Image as ImageIcon,
  FileDown,
  Loader2
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { 
  Quotation, 
  QuotationItem, 
  QuotationDraft,
  Cliente, 
  Produto, 
  User, 
  EmpresaEmitente 
} from '../types';
import { StorageService } from '../lib/storage';
import {
  supabase,
  getQuotationsFromSupabase,
  insertQuotationToSupabase,
  deleteQuotationFromSupabase,
  getClientesFromSupabase,
  getProdutosFromSupabase,
} from '../lib/supabaseClient';
import { 
  formatCurrency, 
  formatDateTime, 
  getPropostaFileName, 
  getWhatsAppShareUrl, 
  getQuotationFormattedText,
  generatePropostaHTML,
  exportQuotationAsPDF,
  NOVUM_LUBRAX_LOGO_SVG
} from '../lib/pdfPngGenerator';

export const PRAZOS_PAGAMENTO = [
  'AVISTA',
  '07 DIAS',
  '14/21 DIAS (2X)',
  '14/21/28 DIAS (3X)',
  '14/21/28/35 DIAS (4X)',
  '14/21/28/35/42 DIAS (5X)',
  '14/21/28/35/42/49 DIAS (6X)',
  '15 DIAS',
  '15/30 DIAS (2X)',
  '15/30/45/60',
  '21/28/35 DIAS (3X)',
  '21/28/35/42 DIAS (4X)',
  '21/28/35/42/49 DIAS (5X)',
  '28 DIAS',
  '30 DIAS',
  '30/45',
  '30/45/60',
  '30/45/60/75',
  '30/45/60/75/90',
  '30/60',
  '30/60/90'
];

interface QuotationsModuleProps {
  currentUser: User;
  workspaceId: string;
}

export const QuotationsModule: React.FC<QuotationsModuleProps> = ({ currentUser, workspaceId }) => {
  const [quotations, setQuotations] = useState<Quotation[]>(() => 
    StorageService.getQuotations(workspaceId, currentUser)
  );
  const [empresa, setEmpresa] = useState<EmpresaEmitente>(() => 
    StorageService.getEmpresaEmitente(workspaceId)
  );

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [activeQuotationForPreview, setActiveQuotationForPreview] = useState<Quotation | null>(null);

  // Editing & Draft States
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [editingCodigoProposta, setEditingCodigoProposta] = useState<string | null>(null);
  const [activeDraft, setActiveDraft] = useState<QuotationDraft | null>(() =>
    StorageService.getQuotationDraft(workspaceId, currentUser.id)
  );
  const [saveDraftFeedback, setSaveDraftFeedback] = useState<string | null>(null);

  // New Quotation Form States
  const [clientSearchCode, setClientSearchCode] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clientNotFoundMsg, setClientNotFoundMsg] = useState('');

  // Item Addition Form
  const productCodeInputRef = useRef<HTMLInputElement>(null);
  const [productSearchCode, setProductSearchCode] = useState('');
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [productNotFoundMsg, setProductNotFoundMsg] = useState('');
  const [itemQuantidade, setItemQuantidade] = useState<number>(1);
  const [itemPrecoUnitario, setItemPrecoUnitario] = useState<number>(0);

  // Available Products & Clients for instant selection
  const [availableProdutos, setAvailableProdutos] = useState<Produto[]>(() =>
    StorageService.getProdutos(workspaceId)
  );
  const [availableClientes, setAvailableClientes] = useState<Cliente[]>(() =>
    StorageService.getClientes(workspaceId)
  );

  // Proposal Items
  const [proposalItems, setProposalItems] = useState<QuotationItem[]>([]);

  // Item Edit Modal States
  const [editingItem, setEditingItem] = useState<QuotationItem | null>(null);
  const [editItemCodigo, setEditItemCodigo] = useState('');
  const [editItemDescricao, setEditItemDescricao] = useState('');
  const [editItemEmbalagem, setEditItemEmbalagem] = useState('UN');
  const [editItemQuantidade, setEditItemQuantidade] = useState<number>(1);
  const [editItemPrecoUnitario, setEditItemPrecoUnitario] = useState<number>(0);
  const [editItemNotFoundMsg, setEditItemNotFoundMsg] = useState('');

  // Other Expenses & Freight (Blank string when empty, formatted with prefix R$)
  const [outrasDespesasInput, setOutrasDespesasInput] = useState<string>('');
  const [freteInput, setFreteInput] = useState<string>('');
  const [prazoPagamento, setPrazoPagamento] = useState<string>('AVISTA');

  // Document Export & Download Ref
  const previewDocumentRef = useRef<HTMLDivElement>(null);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportingQuotationId, setExportingQuotationId] = useState<string | null>(null);
  const [copiedQuotationId, setCopiedQuotationId] = useState<string | null>(null);

  // Duplicate Product Notification Alert
  const [duplicateProductAlert, setDuplicateProductAlert] = useState<{
    codigo: string;
    descricao: string;
    itemNum: number;
    quantidade?: number;
    precoUnitario?: number;
    itemId?: string;
  } | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const [isLoadingSupabase, setIsLoadingSupabase] = useState(false);

  const refreshData = async () => {
    setIsLoadingSupabase(true);
    try {
      const [quotes, prods, clis] = await Promise.all([
        getQuotationsFromSupabase(workspaceId, currentUser),
        getProdutosFromSupabase(workspaceId),
        getClientesFromSupabase(workspaceId),
      ]);
      if (quotes) setQuotations(quotes);
      if (prods) setAvailableProdutos(prods);
      if (clis) setAvailableClientes(clis);
      setEmpresa(StorageService.getEmpresaEmitente(workspaceId));
    } catch (err) {
      console.warn('Erro ao sincronizar orçamentos com o Supabase:', err);
      setQuotations(StorageService.getQuotations(workspaceId, currentUser));
      setEmpresa(StorageService.getEmpresaEmitente(workspaceId));
      setAvailableProdutos(StorageService.getProdutos(workspaceId));
      setAvailableClientes(StorageService.getClientes(workspaceId));
    } finally {
      setIsLoadingSupabase(false);
    }
  };

  useEffect(() => {
    refreshData();
    const draft = StorageService.getQuotationDraft(workspaceId, currentUser.id);
    setActiveDraft(draft);

    // Inscrição em tempo real no Supabase para novos orçamentos
    const channel = supabase
      .channel(`realtime-quotations-${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, () => {
        getQuotationsFromSupabase(workspaceId, currentUser).then(setQuotations);
      })
      .subscribe();

    const handleSync = () => refreshData();
    window.addEventListener('smartvisit_quotations_updated', handleSync);
    window.addEventListener('smartvisit_clientes_updated', handleSync);
    window.addEventListener('smartvisit_produtos_updated', handleSync);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('smartvisit_quotations_updated', handleSync);
      window.removeEventListener('smartvisit_clientes_updated', handleSync);
      window.removeEventListener('smartvisit_produtos_updated', handleSync);
    };
  }, [workspaceId, currentUser]);

  // Auto-save draft whenever builder form content changes while open
  useEffect(() => {
    if (!isBuilderOpen) return;

    const hasContent = clientSearchCode.trim() !== '' ||
      selectedCliente !== null ||
      proposalItems.length > 0 ||
      outrasDespesasInput.trim() !== '' ||
      freteInput.trim() !== '';

    if (hasContent) {
      const draftObj: QuotationDraft = {
        workspace_id: workspaceId,
        vendedor_id: currentUser.id,
        editing_quotation_id: editingQuotationId,
        editing_codigo_proposta: editingCodigoProposta,
        client_search_code: clientSearchCode,
        selected_cliente: selectedCliente,
        proposal_items: proposalItems,
        outras_despesas_input: outrasDespesasInput,
        frete_input: freteInput,
        prazo_pagamento: prazoPagamento,
        updated_at: new Date().toISOString(),
      };
      StorageService.saveQuotationDraft(draftObj);
      setActiveDraft(draftObj);
    }
  }, [
    isBuilderOpen,
    clientSearchCode,
    selectedCliente,
    proposalItems,
    outrasDespesasInput,
    freteInput,
    prazoPagamento,
    editingQuotationId,
    editingCodigoProposta,
    workspaceId,
    currentUser.id,
  ]);

  const resetForm = () => {
    setEditingQuotationId(null);
    setEditingCodigoProposta(null);
    setClientSearchCode('');
    setSelectedCliente(null);
    setProductSearchCode('');
    setSelectedProduto(null);
    setProposalItems([]);
    setOutrasDespesasInput('');
    setFreteInput('');
    setPrazoPagamento('AVISTA');
    setClientNotFoundMsg('');
    setProductNotFoundMsg('');
  };

  const restoreDraftToForm = (draft: QuotationDraft) => {
    setEditingQuotationId(draft.editing_quotation_id || null);
    setEditingCodigoProposta(draft.editing_codigo_proposta || null);
    setClientSearchCode(draft.client_search_code || '');
    setSelectedCliente(draft.selected_cliente || null);
    setProposalItems(draft.proposal_items ? draft.proposal_items.map(i => ({ ...i })) : []);
    setOutrasDespesasInput(draft.outras_despesas_input || '');
    setFreteInput(draft.frete_input || '');
    setPrazoPagamento(draft.prazo_pagamento || 'AVISTA');
  };

  const handleDiscardDraft = () => {
    StorageService.clearQuotationDraft(workspaceId, currentUser.id);
    setActiveDraft(null);
    resetForm();
  };

  const handleSaveDraftAndExit = () => {
    const draftObj: QuotationDraft = {
      workspace_id: workspaceId,
      vendedor_id: currentUser.id,
      editing_quotation_id: editingQuotationId,
      editing_codigo_proposta: editingCodigoProposta,
      client_search_code: clientSearchCode,
      selected_cliente: selectedCliente,
      proposal_items: proposalItems,
      outras_despesas_input: outrasDespesasInput,
      frete_input: freteInput,
      updated_at: new Date().toISOString(),
    };
    StorageService.saveQuotationDraft(draftObj);
    setActiveDraft(draftObj);
    setIsBuilderOpen(false);
    setSaveDraftFeedback('Seu rascunho de orçamento foi salvo. Você pode consultar o Feed e voltar a qualquer momento!');
    setTimeout(() => setSaveDraftFeedback(null), 5000);
  };

  const handleStartEditingQuotation = (quotation: Quotation) => {
    setEditingQuotationId(quotation.id);
    setEditingCodigoProposta(quotation.codigo_proposta);
    setClientSearchCode(quotation.cliente_codigo);
    setSelectedCliente({
      id: `cli-${quotation.cliente_codigo}`,
      workspace_id: workspaceId,
      codigo: quotation.cliente_codigo,
      razao_social: quotation.cliente_razao_social,
      endereco: quotation.cliente_endereco,
      bairro: quotation.cliente_bairro,
      cidade: quotation.cliente_cidade,
      uf: quotation.cliente_uf,
      cep: quotation.cliente_cep,
      telefone: quotation.cliente_telefone,
    });
    setProposalItems(quotation.itens.map(i => ({ ...i })));
    setOutrasDespesasInput(quotation.outras_despesas !== undefined ? String(quotation.outras_despesas) : '');
    setFreteInput(quotation.frete !== undefined ? String(quotation.frete) : '');
    setPrazoPagamento(quotation.prazo_pagamento || 'AVISTA');
    setIsBuilderOpen(true);
  };

  const handleDeleteQuotation = async (quotation: Quotation) => {
    if (confirm(`Tem certeza que deseja excluir o orçamento ${quotation.codigo_proposta || quotation.numero_sequencial}?`)) {
      try {
        await deleteQuotationFromSupabase(quotation.id);
      } catch (err: any) {
        console.error('Erro ao deletar orçamento no Supabase:', err);
      }
      setQuotations(prev => prev.filter(q => q.id !== quotation.id));
      StorageService.deleteQuotation(quotation.id);
      refreshData();
    }
  };

  // Handle Client Auto-fill by Code
  const handleClientCodeSearch = (codeVal: string) => {
    setClientSearchCode(codeVal);
    setClientNotFoundMsg('');
    if (!codeVal.trim()) {
      setSelectedCliente(null);
      return;
    }
    const clean = codeVal.trim().toUpperCase();
    const found = StorageService.getClienteByCodigo(workspaceId, clean) ||
      availableClientes.find(c => c.codigo.trim().toUpperCase() === clean);
    if (found) {
      setSelectedCliente(found);
    } else {
      setSelectedCliente(null);
      if (codeVal.length >= 3) {
        setClientNotFoundMsg('Cliente não encontrado com este código.');
      }
    }
  };

  const handleSelectCliente = (cli: Cliente) => {
    setSelectedCliente(cli);
    setClientSearchCode(cli.codigo);
    setClientNotFoundMsg('');
  };

  // Handle Product Auto-fill by Code
  const handleProductCodeSearch = (codeVal: string) => {
    setProductSearchCode(codeVal);
    setProductNotFoundMsg('');
    if (!codeVal.trim()) {
      setSelectedProduto(null);
      setItemPrecoUnitario(0);
      return;
    }
    const clean = codeVal.trim().toUpperCase();
    const found = StorageService.getProdutoByCodigo(workspaceId, clean) ||
      availableProdutos.find(p => p.codigo.trim().toUpperCase() === clean);

    if (found) {
      setSelectedProduto(found);
      const unitPrice = Number(found.preco_base) >= 0 ? Number(found.preco_base) : 0;
      setItemPrecoUnitario(unitPrice);

      // Check if product is already in proposal items
      const existing = proposalItems.find(
        (item) => item.produto_codigo.trim().toUpperCase() === found.codigo.trim().toUpperCase()
      );
      if (existing) {
        setProductNotFoundMsg(`Atenção: Este produto já consta no orçamento (Item #${existing.item_num}).`);
      }
    } else {
      setSelectedProduto(null);
      if (codeVal.length >= 3) {
        setProductNotFoundMsg('Produto não encontrado com este código.');
      }
    }
  };

  const handleSelectProduto = (prod: Produto) => {
    setSelectedProduto(prod);
    setProductSearchCode(prod.codigo);
    const unitPrice = Number(prod.preco_base) >= 0 ? Number(prod.preco_base) : 0;
    setItemPrecoUnitario(unitPrice);
    setProductNotFoundMsg('');

    const existing = proposalItems.find(
      (item) => item.produto_codigo.trim().toUpperCase() === prod.codigo.trim().toUpperCase()
    );
    if (existing) {
      setProductNotFoundMsg(`Atenção: Este produto já consta no orçamento (Item #${existing.item_num}).`);
    }
  };

  // Add Item to Proposal List
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduto) return;

    // Check if product already exists in proposal items - BLOCK DUPLICATES
    const existingIndex = proposalItems.findIndex(
      (item) => item.produto_codigo.trim().toUpperCase() === selectedProduto.codigo.trim().toUpperCase()
    );

    if (existingIndex !== -1) {
      const existing = proposalItems[existingIndex];
      // Trigger notification modal
      setDuplicateProductAlert({
        codigo: selectedProduto.codigo,
        descricao: selectedProduto.descricao,
        itemNum: existing.item_num || existingIndex + 1,
        quantidade: existing.quantidade,
        precoUnitario: existing.preco_unitario,
        itemId: existing.id,
      });
      setProductNotFoundMsg(`O produto ${selectedProduto.codigo} já consta no orçamento (Item #${existing.item_num || existingIndex + 1}).`);
      return;
    }

    const qty = Number(itemQuantidade) > 0 ? Number(itemQuantidade) : 1;
    const unitPrice = Number(itemPrecoUnitario) >= 0 ? Number(itemPrecoUnitario) : selectedProduto.preco_base;
    const total = qty * unitPrice;

    const newItem: QuotationItem = {
      id: `item-${Date.now()}-${proposalItems.length}`,
      item_num: proposalItems.length + 1,
      produto_codigo: selectedProduto.codigo,
      descricao: selectedProduto.descricao,
      embalagem: selectedProduto.embalagem || 'UN',
      quantidade: qty,
      preco_unitario: unitPrice,
      preco_total: total,
    };

    setProposalItems([...proposalItems, newItem]);

    // Reset Product Inputs
    setProductSearchCode('');
    setSelectedProduto(null);
    setItemQuantidade(1);
    setItemPrecoUnitario(0);
    setProductNotFoundMsg('');

    // Return focus to product code input for fast entry
    setTimeout(() => {
      productCodeInputRef.current?.focus();
    }, 50);
  };

  const handleRemoveItem = (itemId: string) => {
    const filtered = proposalItems.filter(i => i.id !== itemId);
    const renumbered = filtered.map((item, idx) => ({ ...item, item_num: idx + 1 }));
    setProposalItems(renumbered);
  };

  // Quick inline update for quantity / price
  const handleUpdateItem = (
    itemId: string,
    updatedFields: Partial<QuotationItem>
  ) => {
    setProposalItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const qty = updatedFields.quantidade !== undefined ? Math.max(1, Number(updatedFields.quantidade) || 1) : item.quantidade;
        const price = updatedFields.preco_unitario !== undefined ? Math.max(0, Number(updatedFields.preco_unitario) || 0) : item.preco_unitario;
        const total = qty * price;

        return {
          ...item,
          ...updatedFields,
          quantidade: qty,
          preco_unitario: price,
          preco_total: total,
        };
      })
    );
  };

  // Open Full Item Edit Modal
  const handleOpenEditItemModal = (item: QuotationItem) => {
    setEditingItem(item);
    setEditItemCodigo(item.produto_codigo);
    setEditItemDescricao(item.descricao);
    setEditItemEmbalagem(item.embalagem);
    setEditItemQuantidade(item.quantidade);
    setEditItemPrecoUnitario(item.preco_unitario);
    setEditItemNotFoundMsg('');
  };

  // Handle Product Search inside Edit Item Modal
  const handleEditItemCodeSearch = (codeVal: string) => {
    setEditItemCodigo(codeVal);
    setEditItemNotFoundMsg('');
    if (!codeVal.trim()) return;

    const found = StorageService.getProdutoByCodigo(workspaceId, codeVal);
    if (found) {
      setEditItemDescricao(found.descricao);
      setEditItemEmbalagem(found.embalagem || 'UN');
      setEditItemPrecoUnitario(found.preco_base);
    } else if (codeVal.length >= 3) {
      setEditItemNotFoundMsg('Produto não cadastrado com este código.');
    }
  };

  // Save changes from Edit Item Modal
  const handleSaveEditedItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const qty = Number(editItemQuantidade) > 0 ? Number(editItemQuantidade) : 1;
    const unitPrice = Number(editItemPrecoUnitario) >= 0 ? Number(editItemPrecoUnitario) : 0;
    const total = qty * unitPrice;

    setProposalItems((prev) =>
      prev.map((item) => {
        if (item.id !== editingItem.id) return item;
        return {
          ...item,
          produto_codigo: editItemCodigo.trim().toUpperCase() || item.produto_codigo,
          descricao: editItemDescricao.trim() || item.descricao,
          embalagem: editItemEmbalagem.trim().toUpperCase() || item.embalagem,
          quantidade: qty,
          preco_unitario: unitPrice,
          preco_total: total,
        };
      })
    );

    setEditingItem(null);
  };

  // Calculations
  const subtotalMercadorias = proposalItems.reduce((acc, curr) => acc + curr.preco_total, 0);
  const outrasDespesasNum = outrasDespesasInput.trim() !== '' ? parseFloat(outrasDespesasInput.replace(',', '.')) || 0 : 0;
  const freteNum = freteInput.trim() !== '' ? parseFloat(freteInput.replace(',', '.')) || 0 : 0;
  const valorTotalFinal = subtotalMercadorias + outrasDespesasNum + freteNum;

  // Save Proposal (New or Edit Existing)
  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente) {
      alert('Por favor, informe um Código de Cliente válido.');
      return;
    }
    if (proposalItems.length === 0) {
      alert('Adicione pelo menos um produto à proposta.');
      return;
    }

    // Editing Existing Finalized Quote
    if (editingQuotationId) {
      const existing = quotations.find(q => q.id === editingQuotationId);
      const updatedQuotation: Quotation = {
        id: editingQuotationId,
        numero_sequencial: existing?.numero_sequencial || StorageService.getNextQuotationSeq(workspaceId),
        codigo_proposta: editingCodigoProposta || existing?.codigo_proposta || `PROP-${new Date().getFullYear()}-000000`,
        workspace_id: workspaceId,
        vendedor_id: existing?.vendedor_id || currentUser.id,
        vendedor_nome: existing?.vendedor_nome || currentUser.nome,
        data_emissao: existing?.data_emissao || new Date().toISOString(),

        cliente_codigo: selectedCliente.codigo,
        cliente_razao_social: selectedCliente.razao_social,
        cliente_cnpj: selectedCliente.cnpj || selectedCliente.cpf_cnpj,
        cliente_endereco: selectedCliente.endereco,
        cliente_bairro: selectedCliente.bairro,
        cliente_cidade: selectedCliente.cidade,
        cliente_uf: selectedCliente.uf,
        cliente_cep: selectedCliente.cep,
        cliente_telefone: selectedCliente.telefone,

        itens: proposalItems,
        subtotal_mercadorias: subtotalMercadorias,
        outras_despesas: outrasDespesasInput.trim() !== '' ? outrasDespesasNum : undefined,
        frete: freteInput.trim() !== '' ? freteNum : undefined,
        valor_total: valorTotalFinal,
        prazo_pagamento: prazoPagamento,

        status: existing?.status || 'enviado',
        historico: [
          {
            id: `hist-${Date.now()}`,
            timestamp: new Date().toISOString(),
            usuario_id: currentUser.id,
            usuario_nome: currentUser.nome,
            acao: 'editado',
            detalhes: `Proposta alterada e reemitida por ${currentUser.nome}. Novo Total: R$ ${valorTotalFinal.toFixed(2)}`,
          },
          ...(existing?.historico || []),
        ]
      };

      try {
        await insertQuotationToSupabase(updatedQuotation);
      } catch (err: any) {
        console.error('Erro ao atualizar orçamento no Supabase:', err);
      }

      setQuotations(prev => prev.map(q => q.id === updatedQuotation.id ? updatedQuotation : q));
      StorageService.saveQuotation(updatedQuotation);
      StorageService.clearQuotationDraft(workspaceId, currentUser.id);
      setActiveDraft(null);

      StorageService.logAudit(
        workspaceId,
        currentUser.nome,
        `Alterou orçamento #${updatedQuotation.codigo_proposta}`,
        'Orçamentos',
        `Cliente: ${updatedQuotation.cliente_razao_social} | Novo Total: R$ ${valorTotalFinal.toFixed(2)}`,
        'edicao',
        currentUser.role
      );

      setIsBuilderOpen(false);
      resetForm();
      refreshData();
      setActiveQuotationForPreview(updatedQuotation);
      return;
    }

    // Creating New Quote
    const maxSeq = quotations.length > 0
      ? Math.max(...quotations.map(q => q.numero_sequencial || 1000))
      : 1000;
    const nextSeq = Math.max(maxSeq + 1, StorageService.getNextQuotationSeq(workspaceId));
    const year = new Date().getFullYear();
    const codigoProposta = `PROP-${year}-${String(nextSeq).padStart(6, '0')}`;

    const newQuotation: Quotation = {
      id: `prop-${Date.now()}`,
      numero_sequencial: nextSeq,
      codigo_proposta: codigoProposta,
      workspace_id: workspaceId,
      vendedor_id: currentUser.id,
      vendedor_nome: currentUser.nome,
      data_emissao: new Date().toISOString(),
      
      // Client Copy
      cliente_codigo: selectedCliente.codigo,
      cliente_razao_social: selectedCliente.razao_social,
      cliente_cnpj: selectedCliente.cnpj || selectedCliente.cpf_cnpj,
      cliente_endereco: selectedCliente.endereco,
      cliente_bairro: selectedCliente.bairro,
      cliente_cidade: selectedCliente.cidade,
      cliente_uf: selectedCliente.uf,
      cliente_cep: selectedCliente.cep,
      cliente_telefone: selectedCliente.telefone,

      // Amounts
      itens: proposalItems,
      subtotal_mercadorias: subtotalMercadorias,
      outras_despesas: outrasDespesasInput.trim() !== '' ? outrasDespesasNum : undefined,
      frete: freteInput.trim() !== '' ? freteNum : undefined,
      valor_total: valorTotalFinal,
      prazo_pagamento: prazoPagamento,

      status: 'enviado',
      historico: [
        {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString(),
          usuario_id: currentUser.id,
          usuario_nome: currentUser.nome,
          acao: 'criado',
          detalhes: 'Proposta gerada no sistema.',
        }
      ]
    };

    try {
      await insertQuotationToSupabase(newQuotation);
    } catch (err: any) {
      console.error('Erro ao salvar orçamento no Supabase:', err);
    }

    setQuotations(prev => [newQuotation, ...prev]);
    StorageService.saveQuotation(newQuotation);
    StorageService.clearQuotationDraft(workspaceId, currentUser.id);
    setActiveDraft(null);

    StorageService.logAudit(
      workspaceId,
      currentUser.nome,
      `Criou orçamento #${newQuotation.codigo_proposta}`,
      'Orçamentos',
      `Cliente: ${newQuotation.cliente_razao_social} | Total: R$ ${valorTotalFinal.toFixed(2)}`,
      'criacao',
      currentUser.role
    );

    // Real-time Notification for Vendedores & Gerentes
    StorageService.addNotification({
      workspace_id: workspaceId,
      titulo: 'Novo Orçamento Emitido',
      mensagem: `${currentUser.nome} gerou a proposta #${newQuotation.codigo_proposta} para ${newQuotation.cliente_razao_social} (R$ ${valorTotalFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
      tipo: 'orcamento',
      target_roles: ['vendedor', 'gerente'],
      link_tab: 'quotations',
      entidade_id: newQuotation.id,
    });

    // Reset Form & Open Preview
    setIsBuilderOpen(false);
    resetForm();
    refreshData();
    setActiveQuotationForPreview(newQuotation);
  };

  const handleExportPDF = async (quotation: Quotation, elementRef?: HTMLElement | null) => {
    try {
      setIsExportingPDF(true);
      setExportingQuotationId(quotation.id);
      await exportQuotationAsPDF(quotation, empresa, elementRef);

      // Record History Action
      const updated = { ...quotation };
      updated.historico.unshift({
        id: `hist-${Date.now()}`,
        timestamp: new Date().toISOString(),
        usuario_id: currentUser.id,
        usuario_nome: currentUser.nome,
        acao: 'baixado_pdf' as const,
        detalhes: `Proposta exportada em formato PDF formatado: ${getPropostaFileName(quotation.cliente_razao_social, 'pdf')}`,
      });
      StorageService.saveQuotation(updated);
      refreshData();
    } catch (err) {
      console.error('Erro ao exportar PDF da proposta:', err);
      alert('Erro ao gerar o arquivo PDF da proposta. Tente novamente.');
    } finally {
      setIsExportingPDF(false);
      setExportingQuotationId(null);
    }
  };

  const handleDownloadPNG = async (quotation: Quotation) => {
    if (!previewDocumentRef.current) {
      alert('Erro: elemento de proposta não encontrado.');
      return;
    }
    try {
      setIsDownloadingImage(true);
      const dataUrl = await toPng(previewDocumentRef.current, {
        quality: 1.0,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });

      const fileName = getPropostaFileName(quotation.cliente_razao_social, 'png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Record History Action
      const updated = { ...quotation };
      updated.historico.unshift({
        id: `hist-${Date.now()}`,
        timestamp: new Date().toISOString(),
        usuario_id: currentUser.id,
        usuario_nome: currentUser.nome,
        acao: 'baixado_png' as const,
        detalhes: `Proposta baixada em formato PNG: ${fileName}`,
      });
      StorageService.saveQuotation(updated);
      refreshData();
    } catch (err) {
      console.error('Erro ao baixar proposta em imagem PNG:', err);
      alert('Erro ao gerar a imagem PNG da proposta. Tente novamente.');
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const handleCopyQuotation = async (quotation: Quotation) => {
    try {
      const text = getQuotationFormattedText(quotation, empresa);
      let copied = false;

      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {
          copied = false;
        }
      }

      if (!copied) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedQuotationId(quotation.id);
      setTimeout(() => {
        setCopiedQuotationId((prev) => (prev === quotation.id ? null : prev));
      }, 2500);

      // Record History Action
      const updated = { ...quotation };
      updated.historico.unshift({
        id: `hist-${Date.now()}`,
        timestamp: new Date().toISOString(),
        usuario_id: currentUser.id,
        usuario_nome: currentUser.nome,
        acao: 'copiado' as const,
        detalhes: 'Texto do orçamento copiado para a área de transferência.',
      });
      StorageService.saveQuotation(updated);
      refreshData();
    } catch (err) {
      console.error('Erro ao copiar proposta:', err);
      alert('Não foi possível copiar o texto da proposta.');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Draft Save Feedback Toast */}
      {saveDraftFeedback && (
        <div className="bg-emerald-600 text-white p-3.5 rounded-2xl shadow-lg font-bold text-xs flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <span>{saveDraftFeedback}</span>
          </div>
          <button onClick={() => setSaveDraftFeedback(null)} className="p-1 hover:bg-emerald-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Module Header */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Gestão de Orçamentos & Propostas</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
              PROPOSTA
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Geração instantânea, histórico rastreável, exportação em PDF/Imagem e cópia rápida do orçamento
          </p>
        </div>

        <button
          onClick={() => {
            const draft = StorageService.getQuotationDraft(workspaceId, currentUser.id);
            if (draft && (draft.proposal_items.length > 0 || draft.selected_cliente)) {
              restoreDraftToForm(draft);
            } else {
              resetForm();
            }
            setIsBuilderOpen(true);
          }}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-700/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Orçamento</span>
        </button>
      </div>

      {/* Active Quotation Draft Alert Banner */}
      {activeDraft && (activeDraft.proposal_items.length > 0 || activeDraft.selected_cliente) && !isBuilderOpen && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl font-bold shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-amber-900 text-sm">Rascunho de Orçamento em Andamento</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full uppercase">
                  {activeDraft.editing_codigo_proposta ? `Editando ${activeDraft.editing_codigo_proposta}` : 'Novo'}
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                {activeDraft.selected_cliente ? (
                  <>Cliente: <strong>{activeDraft.selected_cliente.razao_social}</strong> ({activeDraft.selected_cliente.codigo}) • </>
                ) : (
                  'Nenhum cliente selecionado • '
                )}
                <strong>{activeDraft.proposal_items.length} {activeDraft.proposal_items.length === 1 ? 'item' : 'itens'}</strong> no carrinho
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-3 py-2 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl transition-all"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={() => {
                restoreDraftToForm(activeDraft);
                setIsBuilderOpen(true);
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Continuar Orçamento</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quotations List Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Histórico de Orçamentos ({quotations.length})
          </span>
          <span className="text-[11px] text-slate-500">
            {currentUser.role === 'vendedor' ? 'Seus orçamentos' : 'Orçamentos da equipe'}
          </span>
        </div>

        {quotations.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">Nenhum orçamento emitido ainda.</p>
            <p className="text-xs text-slate-500 mt-1">Clique em "Criar Novo Orçamento" para iniciar uma proposta.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {quotations.map((q) => (
              <div 
                key={q.id} 
                className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 w-full min-w-0"
              >
                {/* Proposal Info */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="font-extrabold text-blue-900 text-sm shrink-0">
                      {q.codigo_proposta || `Nº ${q.numero_sequencial}`}
                    </span>
                    <span className="text-xs font-bold text-slate-900 break-words">
                      • {q.cliente_razao_social}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full shrink-0">
                      Código: {q.cliente_codigo}
                    </span>
                    {q.historico && q.historico.some(h => h.acao === 'editado') && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                        Editado
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                    <span>Emissão: {formatDateTime(q.data_emissao)}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Vendedor: <strong className="text-slate-700">{q.vendedor_nome}</strong></span>
                    <span>•</span>
                    <span>{q.itens.length} {q.itens.length === 1 ? 'item' : 'itens'}</span>
                    {q.prazo_pagamento && (
                      <span className="text-[10px] bg-blue-100 text-blue-900 font-extrabold px-2 py-0.5 rounded-md border border-blue-200 shrink-0">
                        Condição: {q.prazo_pagamento}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between md:justify-end gap-2.5 sm:gap-4 pt-2.5 sm:pt-0 border-t border-slate-100 sm:border-0 min-w-0">
                  <div className="flex items-center justify-between sm:block text-left md:text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase sm:block">Valor Total</span>
                    <span className="text-base sm:text-lg font-black text-slate-900">{formatCurrency(q.valor_total)}</span>
                  </div>

                  <div className="grid grid-cols-5 sm:flex sm:items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() => handleExportPDF(q)}
                      disabled={isExportingPDF && exportingQuotationId === q.id}
                      className="p-2 text-rose-700 hover:text-rose-800 hover:bg-rose-50 rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
                      title="Exportar Proposta em PDF formatado"
                    >
                      {isExportingPDF && exportingQuotationId === q.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                      ) : (
                        <FileDown className="w-4 h-4 text-rose-600" />
                      )}
                      <span className="hidden lg:inline">PDF</span>
                    </button>

                    <button
                      onClick={() => handleStartEditingQuotation(q)}
                      className="p-2 text-slate-700 hover:text-amber-800 hover:bg-amber-50 rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1 text-xs font-bold cursor-pointer"
                      title="Editar este orçamento finalizado"
                    >
                      <Edit3 className="w-4 h-4 text-amber-600" />
                      <span className="hidden lg:inline">Editar</span>
                    </button>

                    <button
                      onClick={() => setActiveQuotationForPreview(q)}
                      className="p-2 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1 text-xs font-bold cursor-pointer"
                      title="Visualizar Proposta em PDF/PNG"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden lg:inline">Ver PDF</span>
                    </button>

                    <button
                      onClick={() => handleCopyQuotation(q)}
                      className={`p-2 rounded-xl border transition-all flex items-center justify-center gap-1 text-xs font-bold cursor-pointer ${
                        copiedQuotationId === q.id
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'text-emerald-700 hover:bg-emerald-50 border-emerald-200'
                      }`}
                      title="Copiar texto do orçamento para enviar no WhatsApp ou colar onde quiser"
                    >
                      {copiedQuotationId === q.id ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="hidden lg:inline">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span className="hidden lg:inline">Copiar</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteQuotation(q)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1 text-xs font-bold cursor-pointer"
                      title="Excluir este orçamento"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                      <span className="hidden lg:inline">Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NEW / EDIT QUOTATION BUILDER MODAL */}
      {isBuilderOpen && (
        <div 
          onClick={() => setIsBuilderOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-100 p-4 sm:p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto cursor-default"
          >
            {/* Modal Title */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-700" />
                  <span>
                    {editingQuotationId
                      ? `Editando Orçamento (${editingCodigoProposta})`
                      : 'Novo Orçamento (PROPOSTA)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Preencha o código do cliente e adicione os produtos desejados.
                </p>
              </div>
              <button
                onClick={handleSaveDraftAndExit}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                title="Salvar rascunho e fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Automatic Draft Info Notice */}
            <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-bold">Seu progresso é salvo automaticamente!</strong> Se precisar consultar preços no <strong>Feed Interno</strong> ou verificar dados de clientes e produtos, clique em <em>"Sair e Continuar Depois"</em> e volte a qualquer momento para concluir este orçamento.
              </div>
            </div>

            {/* STEP 1: CLIENT AUTO-FILL */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>1. Dados do Cliente</span>
                </span>
                
                <div className="flex items-center gap-2">
                  {selectedCliente && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      ✓ Cliente Localizado
                    </span>
                  )}
                  {availableClientes.length > 0 && (
                    <select
                      value={selectedCliente ? selectedCliente.codigo : ''}
                      onChange={(e) => {
                        const cli = availableClientes.find(c => c.codigo === e.target.value);
                        if (cli) handleSelectCliente(cli);
                      }}
                      className="text-xs bg-white border border-slate-300 rounded-lg py-1 px-2.5 text-slate-700 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none max-w-[200px] sm:max-w-[280px] truncate shadow-xs cursor-pointer"
                    >
                      <option value="">-- Selecionar da lista ({availableClientes.length}) --</option>
                      {availableClientes.map(c => (
                        <option key={c.id} value={c.codigo}>
                          {c.codigo} - {c.razao_social}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Datalist para autocomplete de clientes */}
              <datalist id="quotation-clientes-autocomplete">
                {availableClientes.map(c => (
                  <option key={c.id} value={c.codigo}>
                    {c.razao_social} • CNPJ: {c.cnpj || c.cpf_cnpj || 'S/N'}
                  </option>
                ))}
              </datalist>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Código do Cliente
                  </label>
                  <input
                    type="text"
                    list="quotation-clientes-autocomplete"
                    value={clientSearchCode}
                    onChange={(e) => handleClientCodeSearch(e.target.value)}
                    placeholder="Digite ex: CLI001"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold uppercase focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    autoFocus
                  />
                  {clientNotFoundMsg && (
                    <span className="text-[11px] text-red-600 font-medium mt-1 block">
                      {clientNotFoundMsg}
                    </span>
                  )}
                </div>

                {/* Auto-filled Read-only details */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Razão Social
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={selectedCliente ? selectedCliente.razao_social : '—'}
                    className="w-full px-3 py-2 bg-slate-200/60 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              {selectedCliente && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                  <div><strong>CNPJ:</strong> {selectedCliente.cnpj || selectedCliente.cpf_cnpj || 'Não cadastrado'}</div>
                  <div><strong>Endereço:</strong> {selectedCliente.endereco}</div>
                  <div><strong>Bairro/Cidade:</strong> {selectedCliente.bairro} - {selectedCliente.cidade}/{selectedCliente.uf}</div>
                  <div><strong>CEP/Tel:</strong> {selectedCliente.cep} | {selectedCliente.telefone}</div>
                </div>
              )}
            </div>

            {/* STEP 2: PRODUCT SEARCH & ADDITION */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>2. Inserir Produto</span>
                </span>

                {availableProdutos.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Ou selecione:</span>
                    <select
                      value={selectedProduto ? selectedProduto.codigo : ''}
                      onChange={(e) => {
                        const prod = availableProdutos.find(p => p.codigo === e.target.value);
                        if (prod) handleSelectProduto(prod);
                      }}
                      className="text-xs bg-white border border-slate-300 rounded-lg py-1 px-2.5 text-slate-700 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none max-w-[240px] sm:max-w-[340px] truncate shadow-xs cursor-pointer"
                    >
                      <option value="">-- Escolher produto anexado ({availableProdutos.length}) --</option>
                      {availableProdutos.map(p => (
                        <option key={p.id} value={p.codigo}>
                          {p.codigo} - {p.descricao} ({p.embalagem}) • R$ {Number(p.preco_base).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Datalist para sugestão rápida ao digitar o código */}
              <datalist id="quotation-produtos-autocomplete">
                {availableProdutos.map(p => (
                  <option key={p.id} value={p.codigo}>
                    {p.descricao} • {p.embalagem} • Preço Unit: R$ {Number(p.preco_base).toFixed(2)}
                  </option>
                ))}
              </datalist>

              <form onSubmit={handleAddItem} className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-3">
                  {/* Product Code */}
                  <div className="col-span-2 sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Código do Produto
                    </label>
                    <input
                      ref={productCodeInputRef}
                      type="text"
                      list="quotation-produtos-autocomplete"
                      value={productSearchCode}
                      onChange={(e) => handleProductCodeSearch(e.target.value)}
                      placeholder="Ex: P1001"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold uppercase focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                    {productNotFoundMsg && (
                      <span className="text-[11px] text-red-600 font-medium mt-1 block">
                        {productNotFoundMsg}
                      </span>
                    )}
                  </div>

                  {/* Descrição & E */}
                  <div className="col-span-2 sm:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Descrição & Embalagem (E)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={selectedProduto ? selectedProduto.descricao : '—'}
                        className="w-full px-3 py-2 bg-slate-200/60 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 truncate"
                      />
                      <span className="px-2.5 py-2 bg-blue-100 text-blue-900 font-extrabold text-xs rounded-xl border border-blue-200 shrink-0">
                        {selectedProduto ? selectedProduto.embalagem : 'E'}
                      </span>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={itemQuantidade}
                      onChange={(e) => setItemQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-center"
                    />
                  </div>

                  {/* Preço Unitário (Preenchido do arquivo e totalmente editável) */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center justify-between">
                      <span>Preço Unit. (R$)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemPrecoUnitario}
                      onChange={(e) => setItemPrecoUnitario(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-right focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                    {selectedProduto && (
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-500">
                        <span>Arquivo: <strong className="text-blue-700">R$ {Number(selectedProduto.preco_base).toFixed(2)}</strong></span>
                        {itemPrecoUnitario !== selectedProduto.preco_base && (
                          <button
                            type="button"
                            onClick={() => setItemPrecoUnitario(selectedProduto.preco_base)}
                            className="text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer"
                            title="Restaurar preço cadastrado no arquivo"
                          >
                            Restaurar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Duplicate Product Warning Banner */}
                {selectedProduto && proposalItems.some(i => i.produto_codigo.trim().toUpperCase() === selectedProduto.codigo.trim().toUpperCase()) && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-2 text-xs font-bold text-amber-900 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Atenção: Este produto já consta no orçamento. Não é permitido adicionar itens duplicados.</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!selectedProduto}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    + Adicionar Item à Proposta
                  </button>
                </div>
              </form>
            </div>

            {/* STEP 3: PROPOSAL ITEMS TABLE */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Itens da Proposta ({proposalItems.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  Você pode alterar a quantidade, o preço ou o produto a qualquer momento.
                </span>
              </div>

              {proposalItems.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl text-center border border-dashed border-slate-300 text-xs text-slate-500">
                  Nenhum produto adicionado à proposta ainda.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {/* Desktop / Tablet Table (Hidden on small mobile) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                        <tr>
                          <th className="p-2.5 text-center w-12">ITEM</th>
                          <th className="p-2.5">DESCRIÇÃO DAS MERCADORIAS</th>
                          <th className="p-2.5 text-center w-16">E</th>
                          <th className="p-2.5 text-center w-36">QTDE</th>
                          <th className="p-2.5 text-right w-36">PREÇO UNIT.</th>
                          <th className="p-2.5 text-right w-28">PREÇO TOTAL</th>
                          <th className="p-2.5 text-center w-20">AÇÕES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {proposalItems.map((item) => (
                          <tr 
                            key={item.id} 
                            className={`transition-all duration-300 ${
                              highlightedItemId === item.id 
                                ? 'bg-amber-100 ring-2 ring-amber-400 font-bold' 
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="p-2.5 text-center font-bold text-slate-500">{item.item_num}</td>
                            <td className="p-2.5 font-bold text-slate-900">
                              <div>
                                <span className="text-blue-700 font-extrabold mr-1">[{item.produto_codigo}]</span>
                                <span>{item.descricao}</span>
                              </div>
                            </td>
                            <td className="p-2.5 text-center font-extrabold text-blue-800">
                              <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded text-[10px]">
                                {item.embalagem}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(item.id, { quantidade: Math.max(1, item.quantidade - 1) })}
                                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors border border-slate-200"
                                  title="Diminuir quantidade"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantidade}
                                  onChange={(e) => handleUpdateItem(item.id, { quantidade: parseInt(e.target.value) || 1 })}
                                  className="w-14 px-1 py-1 text-center font-bold bg-white border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(item.id, { quantidade: item.quantidade + 1 })}
                                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors border border-slate-200"
                                  title="Aumentar quantidade"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-2.5 text-right">
                              <div className="relative inline-block w-28">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.preco_unitario}
                                  onChange={(e) => handleUpdateItem(item.id, { preco_unitario: parseFloat(e.target.value) || 0 })}
                                  className="w-full pl-7 pr-2 py-1 text-right font-bold bg-white border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg text-xs text-slate-900"
                                />
                              </div>
                            </td>
                            <td className="p-2.5 text-right font-black text-slate-900">
                              {formatCurrency(item.preco_total)}
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditItemModal(item)}
                                  className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200"
                                  title="Alterar Produto / Dados Completos"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                                  title="Remover Produto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Items Cards (Visible on mobile screens < 640px) */}
                  <div className="block sm:hidden divide-y divide-slate-200 bg-white">
                    {proposalItems.map((item) => (
                      <div 
                        key={item.id} 
                        className={`p-3 space-y-2.5 transition-all ${
                          highlightedItemId === item.id 
                            ? 'bg-amber-100 ring-2 ring-amber-400 font-bold' 
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="font-extrabold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                              #{item.item_num}
                            </span>
                            <span className="text-blue-700 font-black text-xs shrink-0">
                              [{item.produto_codigo}]
                            </span>
                            <span className="font-bold text-slate-900 text-xs break-words">
                              {item.descricao}
                            </span>
                          </div>
                          <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0">
                            {item.embalagem}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                          {/* Quantity */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Quantidade</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(item.id, { quantidade: Math.max(1, item.quantidade - 1) })}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantidade}
                                onChange={(e) => handleUpdateItem(item.id, { quantidade: parseInt(e.target.value) || 1 })}
                                className="w-12 px-1 py-1 text-center font-bold bg-white border border-slate-300 rounded-lg text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(item.id, { quantidade: item.quantidade + 1 })}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Preço Unitário */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Preço Unit. (R$)</span>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.preco_unitario}
                                onChange={(e) => handleUpdateItem(item.id, { preco_unitario: parseFloat(e.target.value) || 0 })}
                                className="w-full pl-7 pr-2 py-1 text-right font-bold bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">Total:</span>
                            <span className="font-black text-slate-900 text-sm">
                              {formatCurrency(item.preco_total)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditItemModal(item)}
                              className="px-2.5 py-1 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="px-2.5 py-1 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* EDIT ITEM MODAL */}
            {editingItem && (
              <div 
                onClick={() => setEditingItem(null)}
                className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto cursor-pointer animate-in fade-in duration-150"
              >
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4 my-auto cursor-default"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                        <Edit3 className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">
                          Alterar Produto do Orçamento
                        </h4>
                        <p className="text-xs text-slate-500">
                          Item #{editingItem.item_num} da Proposta Comercial
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingItem(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveEditedItem} className="space-y-4">
                    {/* Código e Embalagem */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Código do Produto
                        </label>
                        <input
                          type="text"
                          list="quotation-produtos-autocomplete"
                          value={editItemCodigo}
                          onChange={(e) => handleEditItemCodeSearch(e.target.value)}
                          placeholder="Ex: P1001"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold uppercase focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                        {editItemNotFoundMsg && (
                          <span className="text-[11px] text-amber-600 font-medium mt-1 block">
                            {editItemNotFoundMsg}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Embalagem (E)
                        </label>
                        <input
                          type="text"
                          value={editItemEmbalagem}
                          onChange={(e) => setEditItemEmbalagem(e.target.value.toUpperCase())}
                          placeholder="UN"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-center uppercase focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Descrição */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Descrição do Produto
                      </label>
                      <input
                        type="text"
                        value={editItemDescricao}
                        onChange={(e) => setEditItemDescricao(e.target.value)}
                        placeholder="Descrição da mercadoria"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        required
                      />
                    </div>

                    {/* Quantidade e Preço Unitário */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Quantidade
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditItemQuantidade(Math.max(1, editItemQuantidade - 1))}
                            className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 font-bold text-slate-700 text-sm flex items-center justify-center transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={editItemQuantidade}
                            onChange={(e) => setEditItemQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-blue-600 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setEditItemQuantidade(editItemQuantidade + 1)}
                            className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 font-bold text-slate-700 text-sm flex items-center justify-center transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Preço Unitário
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editItemPrecoUnitario}
                            onChange={(e) => setEditItemPrecoUnitario(parseFloat(e.target.value) || 0)}
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-right focus:ring-2 focus:ring-blue-600 focus:outline-none"
                          />
                        </div>
                        {(() => {
                          const orig = availableProdutos.find(p => p.codigo.trim().toUpperCase() === editItemCodigo.trim().toUpperCase());
                          if (!orig) return null;
                          return (
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-500">
                              <span>Arquivo: <strong className="text-blue-700">R$ {Number(orig.preco_base).toFixed(2)}</strong></span>
                              {editItemPrecoUnitario !== orig.preco_base && (
                                <button
                                  type="button"
                                  onClick={() => setEditItemPrecoUnitario(orig.preco_base)}
                                  className="text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer"
                                  title="Restaurar preço cadastrado no arquivo"
                                >
                                  Restaurar original
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Preço Total Preview */}
                    <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-950 uppercase">Preço Total Recalculado:</span>
                      <span className="text-base font-black text-blue-700">
                        {formatCurrency((Number(editItemQuantidade) || 0) * (Number(editItemPrecoUnitario) || 0))}
                      </span>
                    </div>

                    {/* Modal Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-700/20 transition-all flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Salvar Alterações do Item</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* STEP 4: CONDIÇÃO DE PAGAMENTO, OTHER EXPENSES, FREIGHT & TOTAL SUMMARY */}
            <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Condição de Pagamento & Despesas
                </span>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Condição de Pagamento
                  </label>
                  <select
                    value={prazoPagamento}
                    onChange={(e) => setPrazoPagamento(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    {PRAZOS_PAGAMENTO.map((prazo) => (
                      <option key={prazo} value={prazo}>
                        {prazo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Outras Despesas e Frete (Opcionais)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Outras Despesas
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                        <input
                          type="text"
                          value={outrasDespesasInput}
                          onChange={(e) => setOutrasDespesasInput(e.target.value)}
                          placeholder=" "
                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-right"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Frete
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                        <input
                          type="text"
                          value={freteInput}
                          onChange={(e) => setFreteInput(e.target.value)}
                          placeholder=" "
                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-right"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Mercadorias:</span>
                    <strong className="text-slate-900">{formatCurrency(subtotalMercadorias)}</strong>
                  </div>
                  {outrasDespesasNum > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Outras Despesas:</span>
                      <strong>{formatCurrency(outrasDespesasNum)}</strong>
                    </div>
                  )}
                  {freteNum > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Frete:</span>
                      <strong>{formatCurrency(freteNum)}</strong>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                  <span className="font-extrabold text-blue-950 uppercase">Valor Total:</span>
                  <span className="text-lg font-black text-blue-700">{formatCurrency(valorTotalFinal)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSaveDraftAndExit}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-200 cursor-pointer"
                title="Salva seu progresso para você verificar o Feed e retornar depois"
              >
                <Clock className="w-4 h-4 text-slate-600" />
                <span>Sair e Continuar Depois (Salvar Rascunho)</span>
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer text-center"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuotation}
                  disabled={!selectedCliente || proposalItems.length === 0}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {editingQuotationId ? 'Salvar Alterações do Orçamento' : 'Emitir Proposta Comercial'}
                  </span>
                </button>
              </div>
            </div>

            {/* DUPLICATE PRODUCT NOTIFICATION MODAL */}
            {duplicateProductAlert && (
              <div 
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[80] flex items-center justify-center p-4 animate-in fade-in duration-150"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    const itemId = duplicateProductAlert.itemId;
                    setDuplicateProductAlert(null);
                    if (itemId) {
                      setHighlightedItemId(itemId);
                      setTimeout(() => setHighlightedItemId(null), 3500);
                    }
                  }
                }}
              >
                <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-amber-200 overflow-hidden transform animate-in zoom-in-95 duration-150">
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-white" />
                      <span className="font-black text-sm tracking-tight">Produto Já Adicionado</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const itemId = duplicateProductAlert.itemId;
                        setDuplicateProductAlert(null);
                        if (itemId) {
                          setHighlightedItemId(itemId);
                          setTimeout(() => setHighlightedItemId(null), 3500);
                        }
                      }}
                      className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                      title="Fechar"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                      <AlertCircle className="w-9 h-9 text-amber-600" />
                    </div>

                    <div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        Este produto já consta no orçamento!
                      </h3>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                        Não é permitido adicionar o mesmo produto mais de uma vez. O item já está na lista deste orçamento:
                      </p>
                    </div>

                    {/* Product Box */}
                    <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-left space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-lg text-xs">
                          {duplicateProductAlert.codigo}
                        </span>
                        <span className="bg-amber-200/90 text-amber-900 font-extrabold px-2.5 py-0.5 rounded-full text-xs">
                          Item #{duplicateProductAlert.itemNum} na lista
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 text-xs leading-snug">
                        {duplicateProductAlert.descricao}
                      </p>
                      {duplicateProductAlert.quantidade !== undefined && (
                        <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-amber-200/60">
                          <span>Quantidade atual: <strong className="text-slate-900">{duplicateProductAlert.quantidade}</strong></span>
                          <span>Preço Unit: <strong className="text-slate-900">{formatCurrency(duplicateProductAlert.precoUnitario || 0)}</strong></span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 leading-relaxed text-left">
                      💡 <strong>Dica:</strong> Se precisar alterar a quantidade ou o valor unitário deste produto, edite diretamente o <strong>Item #{duplicateProductAlert.itemNum}</strong> na tabela de itens.
                    </p>

                    {/* Action Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const itemId = duplicateProductAlert.itemId;
                          setDuplicateProductAlert(null);
                          if (itemId) {
                            setHighlightedItemId(itemId);
                            setTimeout(() => setHighlightedItemId(null), 3500);
                          }
                        }}
                        className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Entendi, Manter Item Atual</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PROPOSAL PREVIEW / EXPORT MODAL */}
      {activeQuotationForPreview && (
        <div 
          onClick={() => setActiveQuotationForPreview(null)}
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto cursor-default"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Pré-visualização da Proposta Comercial
                </h3>
                <p className="text-xs text-slate-500">
                  {getPropostaFileName(activeQuotationForPreview.cliente_razao_social, 'pdf')}
                </p>
              </div>
              <button
                onClick={() => setActiveQuotationForPreview(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable container for landscape preview */}
            <div className="overflow-x-auto pb-2 bg-slate-100/70 p-4 rounded-xl border border-slate-200">
              {/* Document Preview Frame (Fixed 960px width for true A4 landscape rendering) */}
              <div 
                ref={previewDocumentRef}
                className="w-[960px] mx-auto bg-white border border-slate-300 rounded-lg p-6 shadow-md font-sans text-xs text-slate-800 space-y-4"
                style={{ minWidth: '960px', backgroundColor: '#ffffff' }}
              >
                {/* Header Table */}
                <div className="flex justify-between items-start border-b-2 border-blue-900 pb-3">
                  <div>
                    {empresa.logo_url ? (
                      <img src={empresa.logo_url} alt="Logo" className="h-12 max-w-[220px] object-contain mb-1" />
                    ) : (
                      <img src={NOVUM_LUBRAX_LOGO_SVG} alt="Logo" className="h-12 max-w-[220px] object-contain mb-1" />
                    )}
                    <h4 className="font-bold text-sm text-blue-900">{empresa.razao_social}</h4>
                    <div className="text-[10px] text-slate-600 leading-tight mt-0.5">
                      CNPJ: {empresa.cnpj} | I.E.: {empresa.inscricao_estadual}<br />
                      {empresa.endereco} - {empresa.bairro} | {empresa.municipio}/{empresa.uf} - CEP: {empresa.cep}<br />
                      Tel: {empresa.telefone}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-blue-900 tracking-wider">PROPOSTA COMERCIAL</div>
                    <div className="text-sm font-bold text-blue-700">{activeQuotationForPreview.codigo_proposta || `Nº ${activeQuotationForPreview.numero_sequencial}`}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Emissão: {formatDateTime(activeQuotationForPreview.data_emissao)}</div>
                  </div>
                </div>

                {/* Client Box */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dados do Cliente / Faturamento</div>
                  <div className="font-bold text-xs text-slate-900 mb-1">
                    [{activeQuotationForPreview.cliente_codigo}] {activeQuotationForPreview.cliente_razao_social}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[11px] text-slate-700">
                    <div><strong>CNPJ/CPF:</strong> {activeQuotationForPreview.cliente_cnpj || 'Não informado'}</div>
                    <div><strong>Endereço:</strong> {activeQuotationForPreview.cliente_endereco} - {activeQuotationForPreview.cliente_bairro}</div>
                    <div><strong>Cidade/UF:</strong> {activeQuotationForPreview.cliente_cidade}/{activeQuotationForPreview.cliente_uf} - CEP: {activeQuotationForPreview.cliente_cep}</div>
                    <div><strong>Telefone:</strong> {activeQuotationForPreview.cliente_telefone}</div>
                  </div>
                </div>

                {/* Payment Condition Banner */}
                <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200 border-l-4 border-l-blue-900 text-xs text-blue-900 flex items-center gap-2">
                  <strong>CONDIÇÃO DE PAGAMENTO:</strong>
                  <span className="font-black text-blue-700 text-sm tracking-wide">{activeQuotationForPreview.prazo_pagamento || 'AVISTA'}</span>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-blue-900 text-white uppercase text-[10px]">
                      <th className="p-2 text-center w-10">ITEM</th>
                      <th className="p-2">DESCRIÇÃO DAS MERCADORIAS</th>
                      <th className="p-2 text-center w-14">EMB</th>
                      <th className="p-2 text-center w-14">QTDE</th>
                      <th className="p-2 text-right w-32">PREÇO UNIT.</th>
                      <th className="p-2 text-right w-32">PREÇO TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeQuotationForPreview.itens.map((i) => (
                      <tr key={i.id} className="even:bg-slate-50">
                        <td className="p-2 text-center font-bold text-blue-900">{i.item_num}</td>
                        <td className="p-2"><strong>[{i.produto_codigo}]</strong> {i.descricao}</td>
                        <td className="p-2 text-center">
                          <span className="bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-bold text-[10px]">{i.embalagem}</span>
                        </td>
                        <td className="p-2 text-center font-bold">{i.quantidade}</td>
                        <td className="p-2 text-right">{formatCurrency(i.preco_unitario)}</td>
                        <td className="p-2 text-right font-bold text-slate-900">{formatCurrency(i.preco_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Bottom Section with Totals & Disclaimer */}
                <div className="flex justify-between items-start gap-6 pt-2">
                  <div className="flex-1 text-[11px] text-slate-500 italic border-t border-dashed border-slate-300 pt-2">
                    <strong>Observações / Condições Comerciais:</strong><br />
                    "Este orçamento é válido apenas para a data de sua emissão."
                  </div>

                  <div className="w-72">
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="py-1 text-slate-600">TOTAL MERCADORIA:</td>
                          <td className="py-1 text-right font-bold">{formatCurrency(activeQuotationForPreview.subtotal_mercadorias)}</td>
                        </tr>
                        {!!activeQuotationForPreview.outras_despesas && (
                          <tr className="border-b border-slate-100">
                            <td className="py-1 text-slate-600">OUTRAS DESPESAS:</td>
                            <td className="py-1 text-right">{formatCurrency(activeQuotationForPreview.outras_despesas)}</td>
                          </tr>
                        )}
                        {!!activeQuotationForPreview.frete && (
                          <tr className="border-b border-slate-100">
                            <td className="py-1 text-slate-600">FRETE:</td>
                            <td className="py-1 text-right">{formatCurrency(activeQuotationForPreview.frete)}</td>
                          </tr>
                        )}
                        <tr className="bg-blue-50 border-y-2 border-blue-900 text-blue-900 font-bold text-sm">
                          <td className="p-2">VALOR TOTAL:</td>
                          <td className="p-2 text-right">{formatCurrency(activeQuotationForPreview.valor_total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-200 pt-2 mt-4">
                  <div>Vendedor Responsável: <strong>{activeQuotationForPreview.vendedor_nome}</strong></div>
                  <div>SmartVisit - Gestão Corporativa de Vendas</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setActiveQuotationForPreview(null)}
                className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer text-center order-last sm:order-first"
              >
                Fechar
              </button>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    const target = activeQuotationForPreview;
                    setActiveQuotationForPreview(null);
                    handleStartEditingQuotation(target);
                  }}
                  className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  title="Editar produtos, preços e quantidades deste orçamento"
                >
                  <Edit3 className="w-4 h-4 text-amber-700" />
                  <span>Editar</span>
                </button>

                <button
                  onClick={() => handleDownloadPNG(activeQuotationForPreview)}
                  disabled={isDownloadingImage}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                  title="Baixar proposta em imagem PNG"
                >
                  {isDownloadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                  <span>{isDownloadingImage ? 'Baixando...' : 'Baixar Imagem'}</span>
                </button>

                <button
                  onClick={() => handleCopyQuotation(activeQuotationForPreview)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    copiedQuotationId === activeQuotationForPreview.id
                      ? 'bg-emerald-700 text-white shadow-emerald-700/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  }`}
                  title="Copiar texto do orçamento para enviar no WhatsApp ou colar onde quiser"
                >
                  {copiedQuotationId === activeQuotationForPreview.id ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-200" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleExportPDF(activeQuotationForPreview, previewDocumentRef.current)}
                  disabled={isExportingPDF}
                  className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-700/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 hover:scale-[1.02] cursor-pointer"
                  title="Baixar arquivo PDF formatado em alta resolução"
                >
                  {isExportingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  <span>{isExportingPDF ? 'Gerando...' : 'Exportar PDF'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
