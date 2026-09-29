import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import * as cheerio from "cheerio";
import { createRequire } from "module";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

dotenv.config();

// Vector Chunk Interface
interface VectorChunk {
  id: string;
  document_id: string;
  workspace_id: string;
  document_name: string;
  source_type: string;
  source_url?: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  created_at: string;
}

// In-Memory Vector Store (Dual-layer persistence: works immediately out of the box and syncs with Supabase pgvector)
const inMemoryVectorStore: VectorChunk[] = [];

// Helper: Cosine Similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Helper: Clean Text Chunking with Overlap (800-1000 characters, 150 characters overlap)
function chunkText(text: string, chunkSize = 900, overlap = 150): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < cleaned.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex < cleaned.length) {
      // Find a clean boundary (newline, period, semicolon or space)
      const lookback = cleaned.lastIndexOf("\n\n", endIndex);
      if (lookback > startIndex + chunkSize * 0.6) {
        endIndex = lookback;
      } else {
        const periodIdx = cleaned.lastIndexOf(". ", endIndex);
        if (periodIdx > startIndex + chunkSize * 0.6) {
          endIndex = periodIdx + 1;
        } else {
          const spaceIdx = cleaned.lastIndexOf(" ", endIndex);
          if (spaceIdx > startIndex + chunkSize * 0.5) {
            endIndex = spaceIdx;
          }
        }
      }
    } else {
      endIndex = cleaned.length;
    }

    const chunk = cleaned.slice(startIndex, endIndex).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }

    startIndex = endIndex - overlap;
    if (startIndex >= cleaned.length - 30) break;
  }

  return chunks;
}

// Ingestion: Extract Clean Text from Web URL
async function extractTextFromURL(targetUrl: string): Promise<{ title: string; text: string }> {
  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao acessar URL (Status HTTP ${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove scripts, styles, forms, and navigation elements
  $("script, style, noscript, iframe, svg, nav, footer, header, form, button").remove();

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || targetUrl;
  
  // Extract text from body
  const bodyText = $("body")
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

  return { title, text: bodyText };
}

// Ingestion: Extract Clean Text from YouTube Link
async function extractTextFromYouTube(url: string): Promise<{ title: string; text: string }> {
  // Extract Video ID
  const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
  const videoId = videoIdMatch ? videoIdMatch[1] : null;

  if (!videoId) {
    throw new Error("URL do YouTube inválida ou ID do vídeo não encontrado.");
  }

  let videoTitle = `Vídeo YouTube [ID: ${videoId}]`;
  let transcriptText = "";

  // 1. Fetch oEmbed metadata for title & author
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (oembedRes.ok) {
      const oembedData: any = await oembedRes.json();
      videoTitle = oembedData.title || videoTitle;
      transcriptText += `Título do Vídeo: ${oembedData.title}\nCanal/Autor: ${oembedData.author_name || "Desconhecido"}\n\n`;
    }
  } catch {
    // ignore oembed failure
  }

  // 2. Fetch subtitles/timedtext or video page captions
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (pageRes.ok) {
      const pageHtml = await pageRes.text();
      // Try to find captions track url in player response
      const match = pageHtml.match(/"captionTracks":\s*(\[.*?\])/);
      if (match && match[1]) {
        try {
          const tracks = JSON.parse(match[1]);
          if (tracks.length > 0) {
            // Prefer portuguese or english
            const selectedTrack =
              tracks.find((t: any) => t.languageCode?.startsWith("pt")) ||
              tracks.find((t: any) => t.languageCode?.startsWith("en")) ||
              tracks[0];
            if (selectedTrack?.baseUrl) {
              const subRes = await fetch(selectedTrack.baseUrl);
              if (subRes.ok) {
                const subXml = await subRes.text();
                const $sub = cheerio.load(subXml, { xmlMode: true });
                const lines: string[] = [];
                $sub("text").each((_, el) => {
                  const line = $sub(el).text().trim();
                  if (line) lines.push(line);
                });
                if (lines.length > 0) {
                  transcriptText += "--- TRANSCRIÇÃO DAS LEGENDAS DO VÍDEO ---\n" + lines.join(" ");
                }
              }
            }
          }
        } catch {
          // ignore caption parse error
        }
      }
    }
  } catch {
    // ignore page scrape failure
  }

  if (!transcriptText || transcriptText.length < 50) {
    transcriptText += `Este material refere-se ao vídeo técnico do YouTube "${videoTitle}". URL de referência: https://www.youtube.com/watch?v=${videoId}`;
  }

  return { title: videoTitle, text: transcriptText };
}

// Ingestion: Extract Clean Text from Google Docs or Google Slides
async function extractTextFromGoogleDocsOrSlides(url: string): Promise<{ title: string; text: string }> {
  // Google Docs
  const docMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (docMatch && docMatch[1]) {
    const docId = docMatch[1];
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
    const res = await fetch(exportUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });

    if (!res.ok) {
      throw new Error(
        "Não foi possível exportar o Google Docs. Certifique-se de que o documento está com o compartilhamento ativado ('Qualquer pessoa com o link pode ler')."
      );
    }

    const text = await res.text();
    return { title: `Google Docs (${docId.slice(0, 8)})`, text };
  }

  // Google Slides
  const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9-_]+)/);
  if (slidesMatch && slidesMatch[1]) {
    const presentationId = slidesMatch[1];
    const exportHtmlUrl = `https://docs.google.com/presentation/d/${presentationId}/export/html`;
    const res = await fetch(exportHtmlUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });

    if (!res.ok) {
      throw new Error(
        "Não foi possível exportar o Google Slides. Certifique-se de que a apresentação está com o compartilhamento ativado ('Qualquer pessoa com o link pode ler')."
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style").remove();
    const slideText = $("body").text().replace(/\s+/g, " ").trim();

    return { title: `Google Slides (${presentationId.slice(0, 8)})`, text: slideText };
  }

  throw new Error("URL de Google Docs ou Google Slides inválida.");
}

// Inicializa a aplicação Express no escopo do módulo para exportação Serverless (Vercel)
const app = express();

app.use(express.json({ limit: "30mb" }));

// Headers CORS para chamadas de API
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Gemini AI Client lazily
  const getGenAIClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });
  };

  // Initialize Supabase Client lazily
  const getSupabaseClient = (): SupabaseClient | null => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (url && key) {
      try {
        return createClient(url, key);
      } catch (err) {
        console.warn("Supabase init error:", err);
        return null;
      }
    }
    return null;
  };

  // Health Check Endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      app: "SmartVisit",
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      supabaseConfigured: !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)),
      indexedChunksCount: inMemoryVectorStore.length,
    });
  });

  // ==============================================================================
  // 1. ENDPOINT DE INGESTÃO RAG (NOTEBOOKLM)
  // Suporta: Arquivos Locais (PDF, TXT, MD), Links Web, YouTube, Google Docs/Slides
  // ==============================================================================
  app.post("/api/ai/ingest", async (req, res) => {
    try {
      const {
        workspaceId,
        type, // 'file' | 'web' | 'youtube' | 'gdocs' | 'texto' | 'md'
        name,
        content, // base64 para PDF ou texto puro para TXT/MD
        url,
        authorName,
      } = req.body;

      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId é obrigatório." });
      }

      let extractedTitle = name || "Documento";
      let cleanExtractedText = "";
      let sourceType = type || "texto";

      // 1. Extração Limpa de Acordo com o Tipo de Entrada
      if (type === "pdf") {
        if (!content) {
          return res.status(400).json({ error: "Conteúdo do PDF não fornecido." });
        }
        const pdfBuffer = Buffer.from(content, "base64");
        const parsed = await pdfParse(pdfBuffer);
        cleanExtractedText = parsed.text || "";
        sourceType = "pdf";
      } else if (type === "web") {
        if (!url) return res.status(400).json({ error: "URL do site não fornecida." });
        const result = await extractTextFromURL(url);
        extractedTitle = name || result.title;
        cleanExtractedText = result.text;
        sourceType = "web";
      } else if (type === "youtube") {
        if (!url) return res.status(400).json({ error: "Link do YouTube não fornecido." });
        const result = await extractTextFromYouTube(url);
        extractedTitle = name || result.title;
        cleanExtractedText = result.text;
        sourceType = "youtube";
      } else if (type === "gdocs" || type === "gslides") {
        if (!url) return res.status(400).json({ error: "Link do Google Docs/Slides não fornecido." });
        const result = await extractTextFromGoogleDocsOrSlides(url);
        extractedTitle = name || result.title;
        cleanExtractedText = result.text;
        sourceType = type;
      } else if (type === "md" || type === "texto" || type === "file") {
        cleanExtractedText = content || "";
        sourceType = type === "md" ? "md" : "texto";
      } else {
        cleanExtractedText = content || "";
      }

      if (!cleanExtractedText || cleanExtractedText.trim().length === 0) {
        return res.status(400).json({
          error: "Não foi possível extrair texto utilizável desta fonte.",
        });
      }

      // 2. Chunking inteligente com overlap (800-1000 caracteres)
      const textChunks = chunkText(cleanExtractedText, 950, 150);
      if (textChunks.length === 0) {
        return res.status(400).json({ error: "O texto extraído é muito curto para indexação." });
      }

      const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const ai = getGenAIClient();
      const supabase = getSupabaseClient();
      const generatedChunks: VectorChunk[] = [];

      // 3. Geração de Embeddings com Gemini API (gemini-embedding-2)
      for (let i = 0; i < textChunks.length; i++) {
        const chunkContent = textChunks[i];
        let embeddingValues: number[] = [];

        if (ai) {
          try {
            const embedRes: any = await ai.models.embedContent({
              model: "gemini-embedding-2",
              contents: chunkContent,
            });
            embeddingValues = (embedRes.embedding?.values || embedRes.embeddings?.[0]?.values || []) as number[];
          } catch (embedErr) {
            try {
              const fallbackEmbed: any = await ai.models.embedContent({
                model: "gemini-embedding-001",
                contents: chunkContent,
              });
              embeddingValues = (fallbackEmbed.embedding?.values || fallbackEmbed.embeddings?.[0]?.values || []) as number[];
            } catch (fbErr) {
              console.warn(`Aviso ao gerar embedding para chunk ${i}:`, embedErr);
            }
          }
        }

        const chunkObj: VectorChunk = {
          id: `chk-${Date.now()}-${i}`,
          document_id: docId,
          workspace_id: workspaceId,
          document_name: extractedTitle,
          source_type: sourceType,
          source_url: url || undefined,
          chunk_index: i + 1,
          content: chunkContent,
          embedding: embeddingValues,
          created_at: new Date().toISOString(),
        };

        generatedChunks.push(chunkObj);
      }

      // 4. Persistência dos Vetores no Supabase pgvector (se configurado)
      if (supabase && generatedChunks.length > 0) {
        try {
          const rowsToInsert = generatedChunks.map((c) => ({
            document_id: c.document_id,
            workspace_id: c.workspace_id,
            document_name: c.document_name,
            source_type: c.source_type,
            source_url: c.source_url || null,
            chunk_index: c.chunk_index,
            content: c.content,
            embedding: c.embedding && c.embedding.length > 0 ? c.embedding : null,
          }));

          const { error: dbError } = await supabase.from("document_chunks").insert(rowsToInsert);
          if (dbError) {
            console.warn("Aviso ao persistir chunks no Supabase pgvector:", dbError.message);
          } else {
            console.log(`Sucesso: ${rowsToInsert.length} chunks persistidos na tabela document_chunks do Supabase.`);
          }
        } catch (dbErr: any) {
          console.warn("Exceção ao inserir no Supabase pgvector:", dbErr?.message || dbErr);
        }
      }

      // 5. Persistência no Vector Store em Memória / Cache do Servidor
      inMemoryVectorStore.push(...generatedChunks);

      // Tamanho formatado
      const totalChars = cleanExtractedText.length;
      const sizeEstimate = totalChars > 1024 * 1024
        ? `${(totalChars / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(totalChars / 1024))} KB`;

      return res.json({
        success: true,
        document: {
          id: docId,
          workspace_id: workspaceId,
          nome: extractedTitle,
          tipo: sourceType,
          fonte_url: url || undefined,
          conteudo_extraido: cleanExtractedText.slice(0, 2000), // Prévia para visualização
          total_chunks: generatedChunks.length,
          tamanho: sizeEstimate,
          data_upload: new Date().toISOString(),
          autor_nome: authorName || "Usuário",
        },
        chunksCount: generatedChunks.length,
      });
    } catch (err: any) {
      console.error("Erro na Ingestão RAG:", err);
      return res.status(500).json({
        error: "Falha ao processar e indexar fonte de conhecimento.",
        details: err?.message || String(err),
      });
    }
  });

  // ==============================================================================
  // 2. ENDPOINT DE CHAT RAG COM O "PROMPT DE FERRO" E CITAÇÕES ESTILO NOTEBOOKLM
  // ==============================================================================
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const {
        message,
        workspaceId,
        conversationHistory,
        selectedDocumentIds,
        knowledgeDocuments,
        products,
        workspaceName,
      } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Mensagem é obrigatória." });
      }

      const userQuery = message.trim();
      const ai = getGenAIClient();
      const supabase = getSupabaseClient();

      // Fallback sem chave configurada
      if (!ai) {
        return res.json({
          reply: `[Modo Especialista Técnico SmartVisit]:\nAtendendo para o Workspace "${workspaceName || "Empresa"}".\n\nIdentificamos ${knowledgeDocuments?.length || 0} documento(s) e ${products?.length || 0} produto(s) disponíveis na base.\n\n*Nota: Configure a chave GEMINI_API_KEY no painel de Segredos para ativar a inteligência generativa e buscas vetoriais em tempo real.*`,
          citations: [],
        });
      }

      // 1. Gera o Embedding da Pergunta do Usuário
      let queryEmbedding: number[] = [];
      try {
        const queryEmbedRes: any = await ai.models.embedContent({
          model: "gemini-embedding-2",
          contents: userQuery,
        });
        queryEmbedding = (queryEmbedRes.embedding?.values || queryEmbedRes.embeddings?.[0]?.values || []) as number[];
      } catch (embedErr) {
        try {
          const fallbackEmbed: any = await ai.models.embedContent({
            model: "gemini-embedding-001",
            contents: userQuery,
          });
          queryEmbedding = (fallbackEmbed.embedding?.values || fallbackEmbed.embeddings?.[0]?.values || []) as number[];
        } catch {
          console.warn("Aviso ao gerar embedding da pergunta:", embedErr);
        }
      }

      // 2. Busca de Similaridade Vetorial (Supabase pgvector OU Vector Store em Memória)
      let retrievedChunks: {
        document_id?: string;
        document_name: string;
        source_type: string;
        source_url?: string;
        content: string;
        similarity: number;
      }[] = [];

      // Tentativa 1: Supabase RPC match_document_chunks
      if (supabase && queryEmbedding.length > 0) {
        try {
          const { data, error } = await supabase.rpc("match_document_chunks", {
            query_embedding: queryEmbedding,
            match_count: 8,
            filter_workspace_id: workspaceId || null,
          });

          if (!error && data && data.length > 0) {
            retrievedChunks = data.map((d: any) => ({
              document_id: d.document_id,
              document_name: d.document_name,
              source_type: d.source_type,
              source_url: d.source_url,
              content: d.content,
              similarity: d.similarity || 0,
            }));
          }
        } catch (rpcErr) {
          console.warn("Aviso na chamada da RPC match_document_chunks:", rpcErr);
        }
      }

      // Tentativa 2: Busca no Vector Store em Memória (se Supabase não retornou chunks)
      if (retrievedChunks.length === 0 && inMemoryVectorStore.length > 0) {
        let candidateChunks = inMemoryVectorStore;
        if (workspaceId) {
          candidateChunks = candidateChunks.filter((c) => c.workspace_id === workspaceId);
        }
        if (selectedDocumentIds && selectedDocumentIds.length > 0) {
          candidateChunks = candidateChunks.filter((c) => selectedDocumentIds.includes(c.document_id));
        }

        if (queryEmbedding.length > 0) {
          const scored = candidateChunks.map((c) => ({
            document_id: c.document_id,
            document_name: c.document_name,
            source_type: c.source_type,
            source_url: c.source_url,
            content: c.content,
            similarity: c.embedding && c.embedding.length > 0 ? cosineSimilarity(queryEmbedding, c.embedding) : 0,
          }));

          scored.sort((a, b) => b.similarity - a.similarity);
          retrievedChunks = scored.slice(0, 8);
        } else {
          // Se não há embedding, pega os primeiros relevantes
          retrievedChunks = candidateChunks.slice(0, 8).map((c) => ({
            document_id: c.document_id,
            document_name: c.document_name,
            source_type: c.source_type,
            source_url: c.source_url,
            content: c.content,
            similarity: 0.8,
          }));
        }
      }

      // Tentativa 3: Se ainda não há chunks vetoriais, usa os documentos e catálogo enviados pelo cliente
      if (retrievedChunks.length === 0 && knowledgeDocuments && knowledgeDocuments.length > 0) {
        knowledgeDocuments.forEach((doc: any) => {
          if (doc.conteudo_extraido) {
            const rawChunks = chunkText(doc.conteudo_extraido, 800, 100);
            rawChunks.slice(0, 3).forEach((chunk) => {
              retrievedChunks.push({
                document_id: doc.id,
                document_name: doc.nome,
                source_type: doc.tipo || "texto",
                source_url: doc.fonte_url,
                content: chunk,
                similarity: 0.7,
              });
            });
          }
        });
      }

      // Inclui produtos relevantes como fonte de comparação técnica quando pertinente
      if (products && products.length > 0) {
        const queryLower = userQuery.toLowerCase();
        const relevantProds = products.filter((p: any) =>
          queryLower.includes(String(p.codigo).toLowerCase()) ||
          queryLower.includes(String(p.descricao).toLowerCase()) ||
          userQuery.includes("produto") ||
          userQuery.includes("preço") ||
          userQuery.includes("catalogo") ||
          userQuery.includes("comparar")
        );

        const prodsToInclude = relevantProds.length > 0 ? relevantProds.slice(0, 10) : products.slice(0, 6);
        const prodSummary = prodsToInclude
          .map(
            (p: any) =>
              `Produto [${p.codigo}]: ${p.descricao} | Embalagem: ${p.embalagem} | Preço Base: R$ ${Number(p.preco_base).toFixed(2)}`
          )
          .join("\n");

        retrievedChunks.push({
          document_id: "cat-produtos",
          document_name: "Catálogo Oficial de Produtos SmartVisit",
          source_type: "catalogo",
          content: prodSummary,
          similarity: 0.9,
        });
      }

      // 3. Montagem do Contexto Ancorado com Numeração de Citações [1], [2]...
      const citationsMap: {
        index: number;
        document_id?: string;
        document_name: string;
        source_type: string;
        source_url?: string;
        snippet: string;
      }[] = [];

      let formattedContext = "";
      retrievedChunks.forEach((chunk, idx) => {
        const citationNum = idx + 1;
        citationsMap.push({
          index: citationNum,
          document_id: chunk.document_id,
          document_name: chunk.document_name,
          source_type: chunk.source_type,
          source_url: chunk.source_url,
          snippet: chunk.content,
        });

        formattedContext += `\n[${citationNum}] Fonte: "${chunk.document_name}" (Tipo: ${chunk.source_type})\nConteúdo:\n${chunk.content}\n`;
      });

      // 4. "PROMPT DE FERRO" INQUEBRÁVEL (NotebookLM Standard)
      const systemInstruction = `Você é um assistente de inteligência artificial corporativo especialista do sistema SmartVisit para o Workspace "${workspaceName || "Corporativo"}", operando estritamente com a mesma lógica e fidelidade do Google NotebookLM.

REGRA ESTRITA DE PROMPT (INQUEBRÁVEL):
Você é um assistente ancorado em documentos. Responda à pergunta do usuário utilizando ESTRITAMENTE as informações contidas nos trechos de contexto fornecidos abaixo. Se a resposta não estiver presente no contexto, diga claramente "Não encontrei essa informação nas fontes". NUNCA invente informações, não utilize conhecimento externo e não alucine dados.

DIRETRIZES DE CITAÇÃO E ANÁLISE:
1. Para cada afirmação factual, dado técnico, preço, embalagem ou especificação que você responder, insira OBRIGATORIAMENTE o marcador numérico de citação correspondente logo após a frase ou informação, por exemplo: "O produto suporta carga contínua de alta pressão [1] e seu preço base é de R$ 380,00 [2]."
2. Quando o usuário pedir comparações entre produtos (ex: "Compare o produto X com o Y"), compare-os com riqueza de detalhes usando as informações das fontes, organizando se necessário em tópicos ou tabelas limpas, referenciando cada dado com as citações numéricas [1], [2], etc.
3. Se os trechos contiverem resposta parcial, responda a parte existente com as devidas citações e informe com precisão o que não consta nas fontes.
4. Mantenha um tom profissional, direto, seguro e em Português do Brasil.

TRECHOS DE CONTEXTO RECUPERADOS (FONTES OFICIAIS):
${formattedContext || "NENHUM TRECHO DE CONTEXTO DISPONÍVEL."}`;

      // Monta histórico de mensagens anteriores para manter a conversa contínua como ChatGPT
      const contentsPayload: any[] = [];
      if (conversationHistory && Array.isArray(conversationHistory)) {
        // Inclui até as últimas 8 mensagens para manter o fluxo vivo
        const recentHistory = conversationHistory.slice(-8);
        recentHistory.forEach((msg: any) => {
          if (msg.sender === "user") {
            contentsPayload.push({
              role: "user",
              parts: [{ text: msg.text }],
            });
          } else if (msg.sender === "ai") {
            contentsPayload.push({
              role: "model",
              parts: [{ text: msg.text }],
            });
          }
        });
      }

      // Adiciona a pergunta atual
      contentsPayload.push({
        role: "user",
        parts: [{ text: userQuery }],
      });

      // Chamada Gemini com fallback inteligente para resiliência contra picos de demanda
      const candidateModels = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-flash-latest"];
      let response: any = null;
      let lastErr: any = null;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: contentsPayload,
            config: {
              systemInstruction,
              temperature: 0.1, // Temperatura baixa para ancoragem estrita
            },
          });
          if (response && response.text) break;
        } catch (mErr: any) {
          lastErr = mErr;
          console.warn(`Tentativa com modelo ${modelName} falhou, tentando próximo:`, mErr?.message || mErr);
        }
      }

      if (!response && lastErr) {
        throw lastErr;
      }

      const replyText = response?.text || "Não foi possível gerar resposta técnica fundamentada nas fontes.";

      // Filtra as citações que foram efetivamente referenciadas na resposta (ex: [1], [2])
      const activeCitations = citationsMap.filter((c) => {
        const citationRegex = new RegExp(`\\[${c.index}\\]`);
        return citationRegex.test(replyText);
      });

      return res.json({
        reply: replyText,
        citations: activeCitations.length > 0 ? activeCitations : citationsMap.slice(0, 3),
        totalChunksIndexed: inMemoryVectorStore.length,
      });
    } catch (err: any) {
      console.error("Erro na API Gemini RAG Chat:", err);
      return res.status(500).json({
        error: "Erro ao processar consulta com o Especialista Técnico.",
        details: err?.message || String(err),
      });
    }
  });

  // ==============================================================================
  // 3. EXCLUSÃO DE DOCUMENTO E SEUS CHUNKS VETORIAIS
  // ==============================================================================
  app.delete("/api/ai/documents/:id", async (req, res) => {
    try {
      const docId = req.params.id;
      const supabase = getSupabaseClient();

      // Remove da memória
      const initialCount = inMemoryVectorStore.length;
      for (let i = inMemoryVectorStore.length - 1; i >= 0; i--) {
        if (inMemoryVectorStore[i].document_id === docId) {
          inMemoryVectorStore.splice(i, 1);
        }
      }

      // Remove do Supabase
      if (supabase) {
        await supabase.from("document_chunks").delete().eq("document_id", docId);
      }

      return res.json({
        success: true,
        removedChunks: initialCount - inMemoryVectorStore.length,
      });
    } catch (err: any) {
      console.error("Erro ao excluir documento:", err);
      return res.status(500).json({ error: "Erro ao excluir documento.", details: err?.message });
    }
  });

// Exporta o aplicativo Express para o ambiente Serverless da Vercel
export default app;
export { app };

// Inicia o servidor HTTP apenas quando executado fora da Vercel (ex: ambiente de desenvolvimento local)
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== "production") {
    import("vite").then(({ createServer: createViteServer }) => {
      createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      }).then((vite) => {
        app.use(vite.middlewares);
        app.listen(PORT, "0.0.0.0", () => {
          console.log(`Server SmartVisit running on http://0.0.0.0:${PORT}`);
        });
      });
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server SmartVisit running on http://0.0.0.0:${PORT}`);
    });
  }
}

