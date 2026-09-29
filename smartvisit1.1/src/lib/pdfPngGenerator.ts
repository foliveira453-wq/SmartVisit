import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { Quotation, EmpresaEmitente } from '../types';

/**
 * Formats currency in Brazilian Real (R$)
 */
export function formatCurrency(value?: number): string {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Formats date and time
 */
export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Sanitizes client name for filename
 * e.g. "Indústria Metalúrgica Horizonte S.A." -> "INDUSTRIA_METALURGICA_HORIZONTE_SA"
 */
export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Generates official PDF/PNG filename: PROPOSTA_CLIENTE_NOME_DO_CLIENTE.pdf
 */
export function getPropostaFileName(clienteNome: string, ext: 'pdf' | 'png'): string {
  const cleanName = sanitizeFileName(clienteNome || 'CLIENTE');
  return `PROPOSTA_CLIENTE_${cleanName}.${ext}`;
}

export const NOVUM_LUBRAX_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 90" width="220" height="52"><g transform="translate(5, 10)"><path d="M5,10 L22,10 L35,55 L35,10 L48,10 L48,65 L31,65 L18,20 L18,65 L5,65 Z" fill="%23c5192d"/><path d="M12,5 L28,5 L16,40 Z" fill="%23a01222"/></g><text x="58" y="42" font-family="Arial, sans-serif" font-weight="900" font-size="28" fill="%23111827" letter-spacing="-0.5">NOVUM</text><text x="58" y="58" font-family="Arial, sans-serif" font-weight="700" font-size="11" fill="%231f2937" letter-spacing="1">DISTRIBUIDORA</text><line x1="185" y1="12" x2="185" y2="65" stroke="%239ca3af" stroke-width="1.5"/><text x="198" y="30" font-family="Arial, sans-serif" font-weight="700" font-size="9" fill="%23047857" letter-spacing="0.5">DISTRIBUIDOR AUTORIZADO</text><text x="198" y="58" font-family="Arial, sans-serif" font-weight="900" font-size="24" fill="%23064e3b" letter-spacing="1">LUBRAX</text></svg>`;

/**
 * Generates formatted text of the Quotation for copying or sharing
 */
export function getQuotationFormattedText(quotation: Quotation, empresa: EmpresaEmitente): string {
  return `*PROPOSTA COMERCIAL - ${empresa.razao_social}*
*Nº Proposta:* ${quotation.codigo_proposta || quotation.numero_sequencial}
*Cliente:* [${quotation.cliente_codigo}] ${quotation.cliente_razao_social}
*Data:* ${formatDateTime(quotation.data_emissao)}
*Vendedor:* ${quotation.vendedor_nome}
${quotation.prazo_pagamento ? `*Condição de Pagamento:* ${quotation.prazo_pagamento}\n` : ''}
*Itens da Proposta:*
${quotation.itens.map(i => `• ${i.item_num}. ${i.produto_codigo ? `[${i.produto_codigo}] ` : ''}${i.descricao} (${i.embalagem}) - Qtd: ${i.quantidade} x ${formatCurrency(i.preco_unitario)} = ${formatCurrency(i.preco_total)}`).join('\n')}

*Subtotal Mercadorias:* ${formatCurrency(quotation.subtotal_mercadorias)}
${quotation.outras_despesas ? `*Outras Despesas:* ${formatCurrency(quotation.outras_despesas)}\n` : ''}${quotation.frete ? `*Frete:* ${formatCurrency(quotation.frete)}\n` : ''}*VALOR TOTAL:* ${formatCurrency(quotation.valor_total)}

_Este orçamento é válido apenas para a data de sua emissão._`;
}

/**
 * Generates WhatsApp Share Link
 */
export function getWhatsAppShareUrl(quotation: Quotation, empresa: EmpresaEmitente): string {
  const text = getQuotationFormattedText(quotation, empresa);
  const encoded = encodeURIComponent(text);
  const phone = empresa.whatsapp_default ? empresa.whatsapp_default.replace(/\D/g, '') : '';
  if (phone) {
    return `https://wa.me/${phone}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

/**
 * Render complete printable/exportable HTML string for PROPOSTA document in LANDSCAPE mode
 */
export function generatePropostaHTML(quotation: Quotation, empresa: EmpresaEmitente): string {
  const logoSrc = empresa.logo_url || NOVUM_LUBRAX_LOGO_SVG;
  const isVertical = (quotation.itens && quotation.itens.length > 6);
  const pageOrientation = isVertical ? 'A4 portrait' : 'A4 landscape';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${getPropostaFileName(quotation.cliente_razao_social, 'pdf')}</title>
  <style>
    @page {
      size: ${pageOrientation};
      margin: 6mm;
    }
    html, body {
      width: 100%;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      font-size: 11px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page-container {
      width: 960px;
      margin: 0 auto;
      padding: 16px 20px;
      box-sizing: border-box;
      background: #ffffff;
    }
    @media print {
      @page {
        size: ${pageOrientation};
        margin: 6mm;
      }
      html, body {
        width: 100%;
        margin: 0;
        padding: 0;
      }
      .page-container {
        width: 100%;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }

    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 8px;
    }
    .company-logo {
      max-height: 48px;
      max-width: 220px;
      object-fit: contain;
      margin-bottom: 4px;
      display: block;
    }
    .company-title {
      font-size: 15px;
      font-weight: bold;
      color: #1e3a8a;
      margin: 0 0 2px 0;
    }
    .company-details {
      font-size: 10px;
      color: #475569;
      line-height: 1.3;
    }
    .proposal-badge-box {
      text-align: right;
      vertical-align: top;
    }
    .proposal-badge-title {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #1e3a8a;
      margin: 0 0 2px 0;
    }
    .proposal-number {
      font-size: 14px;
      font-weight: bold;
      color: #1d4ed8;
    }
    .proposal-date {
      font-size: 10px;
      color: #64748b;
    }

    .section-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
      background-color: #f8fafc;
    }
    .section-title {
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .client-name {
      font-size: 13px;
      font-weight: bold;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .client-grid {
      display: grid;
      grid-template-columns: 1fr 1.5fr 1.5fr 1fr;
      gap: 4px 12px;
      font-size: 11px;
      color: #334155;
    }

    .payment-condition-banner {
      margin-bottom: 12px;
      padding: 8px 12px;
      background-color: #eff6ff;
      border: 1px solid #bfdbfe;
      border-left: 5px solid #1e3a8a;
      border-radius: 6px;
      font-size: 11px;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
    }
    .pay-value {
      font-weight: 900;
      color: #1d4ed8;
      font-size: 13px;
      letter-spacing: 0.5px;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .items-table th {
      background-color: #1e3a8a;
      color: #ffffff;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      padding: 6px 8px;
      text-align: left;
    }
    .items-table th.right, .items-table td.right {
      text-align: right;
    }
    .items-table th.center, .items-table td.center {
      text-align: center;
    }
    .items-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
      color: #1e293b;
      line-height: 1.25;
    }
    .items-table tr:nth-child(even) {
      background-color: #f8fafc;
    }

    .bottom-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-top: 8px;
    }
    .disclaimer-container {
      flex: 1;
      font-size: 11px;
      color: #64748b;
      font-style: italic;
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
    }

    .totals-table {
      width: 280px;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .totals-table td {
      padding: 4px 8px;
      font-size: 11px;
      color: #334155;
      border-bottom: 1px solid #f1f5f9;
    }
    .totals-table tr.grand-total td {
      font-size: 13px;
      font-weight: bold;
      color: #1e3a8a;
      border-top: 2px solid #1e3a8a;
      border-bottom: 2px solid #1e3a8a;
      background-color: #eff6ff;
      padding: 6px 8px;
    }

    .vendedor-footer {
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <!-- PRINT / DOWNLOAD ACTION BAR (HIDDEN WHEN PRINTING) -->
  <div class="no-print" style="position: sticky; top: 0; background: #1e3a8a; color: white; padding: 10px 16px; margin: 0 0 16px 0; display: flex; align-items: center; justify-content: space-between; font-family: system-ui, -apple-system, sans-serif; border-bottom: 2px solid #0f172a; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999;">
    <div style="font-size: 13px; font-weight: bold; display: flex; align-items: center; gap: 8px;">
      <span>📄 Proposta Comercial ${quotation.codigo_proposta || `Nº ${quotation.numero_sequencial}`}</span>
      <span style="opacity: 0.8; font-weight: normal; font-size: 12px;">(${quotation.cliente_razao_social})</span>
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
        🖨️ Imprimir / Salvar em PDF
      </button>
      <button onclick="window.close()" style="background: #475569; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">
        ✕ Fechar
      </button>
    </div>
  </div>

  <div class="page-container">
    <!-- HEADER -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          ${logoSrc ? `<img src="${logoSrc}" class="company-logo" alt="Logo Empresa" />` : ''}
          <div class="company-title">${empresa.razao_social}</div>
          <div class="company-details">
            CNPJ: ${empresa.cnpj} | I.E.: ${empresa.inscricao_estadual}<br/>
            ${empresa.endereco} - ${empresa.bairro} | ${empresa.municipio}/${empresa.uf} - CEP: ${empresa.cep}<br/>
            Tel: ${empresa.telefone}
          </div>
        </td>
        <td class="proposal-badge-box">
          <div class="proposal-badge-title">PROPOSTA COMERCIAL</div>
          <div class="proposal-number">${quotation.codigo_proposta || `Nº ${quotation.numero_sequencial}`}</div>
          <div class="proposal-date">Emissão: ${formatDateTime(quotation.data_emissao)}</div>
        </td>
      </tr>
    </table>

    <!-- CLIENTE -->
    <div class="section-box">
      <div class="section-title">Dados do Cliente / Faturamento</div>
      <div class="client-name">[${quotation.cliente_codigo}] ${quotation.cliente_razao_social}</div>
      <div class="client-grid">
        <div><strong>CNPJ/CPF:</strong> ${quotation.cliente_cnpj || 'Não informado'}</div>
        <div><strong>Endereço:</strong> ${quotation.cliente_endereco} - ${quotation.cliente_bairro}</div>
        <div><strong>Cidade/UF:</strong> ${quotation.cliente_cidade}/${quotation.cliente_uf} - CEP: ${quotation.cliente_cep}</div>
        <div><strong>Telefone:</strong> ${quotation.cliente_telefone}</div>
      </div>
    </div>

    <!-- CONDIÇÃO DE PAGAMENTO -->
    <div class="payment-condition-banner">
      <span><strong>CONDIÇÃO DE PAGAMENTO:</strong></span>
      <span class="pay-value">${quotation.prazo_pagamento || 'AVISTA'}</span>
    </div>

    <!-- ITENS -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="center" style="width: 40px;">ITEM</th>
          <th>DESCRIÇÃO DAS MERCADORIAS</th>
          <th class="center" style="width: 50px;">EMB</th>
          <th class="center" style="width: 50px;">QTDE</th>
          <th class="right" style="width: 120px;">PREÇO UNIT.</th>
          <th class="right" style="width: 120px;">PREÇO TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${quotation.itens.map(item => `
          <tr>
            <td class="center" style="font-weight: bold; color: #1e3a8a;">${item.item_num}</td>
            <td>
              <strong>[${item.produto_codigo}]</strong> ${item.descricao}
            </td>
            <td class="center"><span style="background-color: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">${item.embalagem}</span></td>
            <td class="center" style="font-weight: bold;">${item.quantidade}</td>
            <td class="right">${formatCurrency(item.preco_unitario)}</td>
            <td class="right" style="font-weight: bold; color: #0f172a;">${formatCurrency(item.preco_total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- BOTTOM SECTION WITH TOTALS & DISCLAIMER -->
    <div class="bottom-section">
      <div class="disclaimer-container">
        <strong>Observações / Condições Comerciais:</strong><br/>
        "Este orçamento é válido apenas para a data de sua emissão."
      </div>

      <div>
        <table class="totals-table">
          <tr>
            <td>TOTAL MERCADORIA:</td>
            <td class="right"><strong>${formatCurrency(quotation.subtotal_mercadorias)}</strong></td>
          </tr>
          ${quotation.outras_despesas ? `
          <tr>
            <td>OUTRAS DESPESAS:</td>
            <td class="right">${formatCurrency(quotation.outras_despesas)}</td>
          </tr>
          ` : ''}
          ${quotation.frete ? `
          <tr>
            <td>FRETE:</td>
            <td class="right">${formatCurrency(quotation.frete)}</td>
          </tr>
          ` : ''}
          <tr class="grand-total">
            <td>VALOR TOTAL:</td>
            <td class="right">${formatCurrency(quotation.valor_total)}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="vendedor-footer">
      <div>Vendedor Responsável: <strong>${quotation.vendedor_nome}</strong></div>
      <div>SmartVisit - Gestão Corporativa de Vendas</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Resizes and compresses an uploaded image file into a light JPEG Data URL (30KB-50KB)
 * to prevent localStorage QuotaExceededError and ensure instant loading.
 */
export function compressImage(
  file: File,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao processar a imagem'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Exports quotation details as a high-resolution, perfectly formatted PDF file.
 * Automatically adapts orientation:
 * - Uses Landscape (horizontal) for compact quotations (few items)
 * - Automatically switches to Portrait (vertical) when quotation is large or has many items,
 *   matching the exact visual format of the downloaded image and preventing squashing.
 * - Handles multi-page portrait output if item list exceeds a single A4 page.
 */
export async function exportQuotationAsPDF(
  quotation: Quotation,
  empresa: EmpresaEmitente,
  targetElement?: HTMLElement | null
): Promise<void> {
  let elementToCapture = targetElement;
  let tempDiv: HTMLDivElement | null = null;

  if (!elementToCapture) {
    tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '960px';
    tempDiv.style.backgroundColor = '#ffffff';
    tempDiv.style.zIndex = '-9999';
    tempDiv.innerHTML = generatePropostaHTML(quotation, empresa);
    document.body.appendChild(tempDiv);
    elementToCapture = (tempDiv.querySelector('.page-container') as HTMLElement) || tempDiv;
    // Allow DOM and any assets/fonts to settle
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  try {
    const dataUrl = await toPng(elementToCapture, {
      quality: 1.0,
      backgroundColor: '#ffffff',
      pixelRatio: 2.5,
    });

    const elemWidth = elementToCapture.offsetWidth || 960;
    const elemHeight = elementToCapture.offsetHeight || 600;
    const aspectRatio = elemHeight / elemWidth;

    // Automatic vertical (portrait) detection for large/tall proposals
    const isVertical = aspectRatio > 0.72 || (quotation.itens && quotation.itens.length > 6);
    const orientation: 'portrait' | 'landscape' = isVertical ? 'portrait' : 'landscape';

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 6;
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });

    const naturalWidth = img.naturalWidth || elemWidth;
    const naturalHeight = img.naturalHeight || elemHeight;

    const renderWidth = availableWidth;
    const totalRenderHeight = renderWidth * (naturalHeight / naturalWidth);

    if (totalRenderHeight <= availableHeight) {
      // Fits comfortably on a single page
      const xOffset = margin + (availableWidth - renderWidth) / 2;
      const yOffset = margin;
      pdf.addImage(dataUrl, 'PNG', xOffset, yOffset, renderWidth, totalRenderHeight, undefined, 'FAST');
    } else {
      // Multi-page portrait slicing to ensure full-width readability without shrinking
      const pxAvailableHeight = (naturalWidth / availableWidth) * availableHeight;
      let sourceY = 0;
      let pageIndex = 0;

      while (sourceY < naturalHeight) {
        if (pageIndex > 0) {
          pdf.addPage('a4', orientation);
        }

        const currentSlicePx = Math.min(pxAvailableHeight, naturalHeight - sourceY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = naturalWidth;
        sliceCanvas.height = currentSlicePx;
        const ctx = sliceCanvas.getContext('2d');

        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, naturalWidth, currentSlicePx);
          ctx.drawImage(
            img,
            0,
            sourceY,
            naturalWidth,
            currentSlicePx,
            0,
            0,
            naturalWidth,
            currentSlicePx
          );

          const sliceDataUrl = sliceCanvas.toDataURL('image/png', 1.0);
          const sliceRenderHeight = (currentSlicePx / naturalWidth) * renderWidth;
          const xOffset = margin + (availableWidth - renderWidth) / 2;
          const yOffset = margin;

          pdf.addImage(
            sliceDataUrl,
            'PNG',
            xOffset,
            yOffset,
            renderWidth,
            sliceRenderHeight,
            undefined,
            'FAST'
          );
        }

        sourceY += currentSlicePx;
        pageIndex++;
      }
    }

    const fileName = getPropostaFileName(quotation.cliente_razao_social, 'pdf');
    pdf.save(fileName);
  } finally {
    if (tempDiv && document.body.contains(tempDiv)) {
      document.body.removeChild(tempDiv);
    }
  }
}

