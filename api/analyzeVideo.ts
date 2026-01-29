import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put, head, get } from "@vercel/blob";

/* =========================
   HELPERS HTTP
========================= */
function send(res: VercelResponse, status: number, data: any) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function parseBody(req: VercelRequest): any {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

/* =========================
   IMAGE NORMALIZER
========================= */
function normalizeImageUrl(input: any): string {
  if (!input) return "";
  const s = String(input).trim();

  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("data:image/")) return s;

  // base64 puro
  if (/^[A-Za-z0-9+/=]+$/.test(s)) {
    const isPng = s.startsWith("iVBOR");
    const mime = isPng ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${s}`;
  }

  return "";
}

function extractOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;

  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (item?.type === "message" && Array.isArray(item?.content)) {
        for (const part of item.content) {
          if (part?.type === "output_text" && typeof part?.text === "string" && part.text.trim()) {
            return part.text;
          }
        }
      }
    }
  }
  return "";
}

/* =========================
   BLOB CACHE
   Env required:
   - BLOB_READ_WRITE_TOKEN
========================= */
function blobPath(videoHash: string) {
  return `viracheck/analysis/${videoHash}.json`;
}

async function blobTryRead(videoHash: string): Promise<any | null> {
  const path = blobPath(videoHash);

  try {
    // primeiro testa se existe
    await head(path);
    // se existe, baixa
    const file = await get(path);
    if (!file?.body) return null;

    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function blobWrite(videoHash: string, data: any) {
  const path = blobPath(videoHash);
  await put(path, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

/* =========================
   HANDLER
========================= */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return send(res, 405, { error: "Método não permitido. Use POST." });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return send(res, 500, {
        error: "OPENAI_API_KEY não configurada",
        details: "Vercel → Project Settings → Environment Variables",
      });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return send(res, 500, {
        error: "BLOB_READ_WRITE_TOKEN não configurado",
        details: "Vercel → Storage → Blob → Connect → cria a env automaticamente",
      });
    }

    const body = parseBody(req);

    const platform = String(body.platform || "Todas");
    const hook = String(body.hook || "");
    const description = String(body.description || "");

    const video_hash = String(body.video_hash || "");
    const video_meta = typeof body.video_meta === "object" && body.video_meta ? body.video_meta : {};
    const framesRaw = Array.isArray(body.frames) ? body.frames : [];

    if (!video_hash) return send(res, 400, { error: "video_hash é obrigatório." });

    // ✅ 1) CHECA SE JÁ EXISTE NO BLOB
    const cached = await blobTryRead(video_hash);
    if (cached?.result) {
      return send(res, 200, { result: cached.result, cached: true });
    }

    // ✅ 2) SE NÃO EXISTE, ANALISA
    const normalizedImages = framesRaw
      .map((f: any) => normalizeImageUrl(f?.image ?? f))
      .filter(Boolean);

    if (!normalizedImages.length) {
      return send(res, 400, {
        error: "Nenhum frame válido recebido",
        details: "Envie frames como data:image/... ou base64.",
      });
    }

    const system = `
Você é especialista em viralização (TikTok, Reels, Shorts).
Responda SEMPRE em pt-BR.

REGRA OBRIGATÓRIA:
- score_viralizacao = soma de 5 critérios (0..20 cada):
  hook_impacto, qualidade_visual, clareza_mensagem,
  legibilidade_texto_legenda, potencial_engajamento.

Retorne SOMENTE JSON no schema exigido.
`;

    const userText = `
Plataforma: ${platform}
Gancho (opcional): ${hook}
Descrição (opcional): ${description}

Hash do vídeo: ${video_hash}

Metadados:
${JSON.stringify(video_meta, null, 2)}

Tarefa:
1) Analise os frames.
2) Dê notas (0..20) para os 5 critérios.
3) Faça score_viralizacao = soma (0..100).
4) Gere pontos fortes/fracos, melhorias, ganchos, legendas, hashtags.
`;

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        criterios: {
          type: "object",
          additionalProperties: false,
          properties: {
            hook_impacto: { type: "integer", minimum: 0, maximum: 20 },
            qualidade_visual: { type: "integer", minimum: 0, maximum: 20 },
            clareza_mensagem: { type: "integer", minimum: 0, maximum: 20 },
            legibilidade_texto_legenda: { type: "integer", minimum: 0, maximum: 20 },
            potencial_engajamento: { type: "integer", minimum: 0, maximum: 20 },
          },
          required: [
            "hook_impacto",
            "qualidade_visual",
            "clareza_mensagem",
            "legibilidade_texto_legenda",
            "potencial_engajamento",
          ],
        },
        score_viralizacao: { type: "integer", minimum: 0, maximum: 100 },
        resumo: { type: "string" },
        pontos_fortes: { type: "array", items: { type: "string" } },
        pontos_fracos: { type: "array", items: { type: "string" } },
        melhorias_praticas: { type: "array", items: { type: "string" } },
        ganchos: { type: "array", items: { type: "string" } },
        legendas: { type: "array", items: { type: "string" } },
        hashtags: { type: "array", items: { type: "string" } },
        observacoes: { type: "string" },
      },
      required: [
        "criterios",
        "score_viralizacao",
        "resumo",
        "pontos_fortes",
        "pontos_fracos",
        "melhorias_praticas",
        "ganchos",
        "legendas",
        "hashtags",
        "observacoes",
      ],
    };

    const payload = {
      model: "gpt-4o-mini",
      temperature: 0,
      max_output_tokens: 900,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        {
          role: "user",
          content: [
            { type: "input_text", text: userText },
            ...normalizedImages.map((img) => ({ type: "input_image", image_url: img })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "viracheck_analysis",
          strict: true,
          schema,
        },
      },
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await r.text();
    if (!r.ok) return send(res, r.status, { error: "Falha na OpenAI API", details: raw.slice(0, 2000) });

    const data = JSON.parse(raw);
    const out = extractOutputText(data);
    if (!out) return send(res, 500, { error: "OpenAI não retornou texto", details: JSON.stringify(data).slice(0, 1500) });

    const result = JSON.parse(out);

    // valida soma do score
    const c = result?.criterios || {};
    const sum =
      (Number(c.hook_impacto) || 0) +
      (Number(c.qualidade_visual) || 0) +
      (Number(c.clareza_mensagem) || 0) +
      (Number(c.legibilidade_texto_legenda) || 0) +
      (Number(c.potencial_engajamento) || 0);

    if (Number(result.score_viralizacao) !== sum) {
      result.score_viralizacao = Math.max(0, Math.min(100, sum));
      result.observacoes = `${result.observacoes || ""} (Score ajustado pela soma dos critérios.)`.trim();
    }

    // ✅ 3) SALVA NO BLOB (mesmo vídeo => mesmo resultado)
    await blobWrite(video_hash, { result });

    return send(res, 200, { result, cached: false });
  } catch (err: any) {
    return send(res, 500, { error: "Erro interno", details: err?.message || String(err) });
  }
}

