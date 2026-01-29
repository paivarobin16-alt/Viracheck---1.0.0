import type { VercelRequest, VercelResponse } from "@vercel/node";

/* =========================
   HTTP helpers
========================= */
function send(res: VercelResponse, status: number, data: any) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseBody(req: VercelRequest): any {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    const j = safeJsonParse(req.body);
    return j ?? {};
  }
  return {};
}

/* =========================
   Image normalizer
========================= */
function normalizeImageUrl(input: any): string {
  if (!input) return "";
  const s = String(input).trim();

  // URL normal
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  // data URL já ok
  if (s.startsWith("data:image/")) return s;

  // base64 puro -> vira data URL
  if (/^[A-Za-z0-9+/=]+$/.test(s)) {
    const isPng = s.startsWith("iVBOR");
    const mime = isPng ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${s}`;
  }

  return "";
}

function extractOutputText(data: any): string {
  // novo campo pode existir:
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  // fallback: varre output
  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (item?.type === "message" && Array.isArray(item?.content)) {
        for (const part of item.content) {
          if (part?.type === "output_text" && typeof part.text === "string") {
            return part.text;
          }
        }
      }
    }
  }

  return "";
}

/* =========================
   Vercel Blob REST (cache)
========================= */
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function blobKey(hash: string) {
  return `viracheck/analysis/${hash}.json`;
}

async function blobGet(path: string) {
  const r = await fetch(`https://blob.vercel-storage.com/${path}`, {
    headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
  });
  if (!r.ok) return null;
  return await r.json();
}

async function blobPut(path: string, data: any) {
  const r = await fetch("https://blob.vercel-storage.com", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${BLOB_TOKEN}`,
      "Content-Type": "application/json",
      "x-vercel-blob-pathname": path,
      "x-vercel-blob-access": "private",
      "x-vercel-blob-add-random-suffix": "0",
    },
    body: JSON.stringify(data),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Blob PUT failed: ${t}`);
  }
}

/* =========================
   Handler
========================= */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return send(res, 405, { error: "Método não permitido. Use POST." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return send(res, 500, {
        error: "OPENAI_API_KEY ausente",
        hint: "Vercel > Project > Settings > Environment Variables",
      });
    }

    if (!BLOB_TOKEN) {
      return send(res, 500, {
        error: "BLOB_READ_WRITE_TOKEN ausente",
        hint: "Crie um Vercel Blob e adicione o token nas variáveis",
      });
    }

    const body = parseBody(req);

    const video_hash = String(body.video_hash || "").trim();
    if (!video_hash) {
      return send(res, 400, { error: "video_hash é obrigatório" });
    }

    // ✅ Cache: mesmo vídeo => mesmo resultado
    const cachePath = blobKey(video_hash);
    const cached = await blobGet(cachePath);
    if (cached?.result) {
      return send(res, 200, { result: cached.result, cached: true });
    }

    const frames = (Array.isArray(body.frames) ? body.frames : [])
      .map((f: any) => normalizeImageUrl(f?.image ?? f))
      .filter(Boolean);

    if (!frames.length) {
      return send(res, 400, {
        error: "Nenhum frame válido",
        hint: "Envie data:image/... ou URL https://...",
      });
    }

    const system = `
Você é especialista em viralização (TikTok, Reels, Shorts).
Responda sempre em PT-BR.

REGRAS IMPORTANTES:
- Retorne SOMENTE JSON válido.
- O score_viralizacao deve ser a SOMA EXATA de:
  hook_impacto + qualidade_visual + clareza_mensagem + legibilidade_texto_legenda + potencial_engajamento.
- Cada critério vai de 0 a 20.
`;

    const payload = {
      model: "gpt-4o-mini",
      temperature: 0,
      max_output_tokens: 900,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Analise os frames do vídeo e gere o JSON." },
            ...frames.map((img) => ({
              type: "input_image",
              image_url: img,
            })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "viracheck",
          strict: true,
          schema: {
            type: "object",
            required: ["criterios", "score_viralizacao", "resumo"],
            properties: {
              criterios: {
                type: "object",
                required: [
                  "hook_impacto",
                  "qualidade_visual",
                  "clareza_mensagem",
                  "legibilidade_texto_legenda",
                  "potencial_engajamento",
                ],
                properties: {
                  hook_impacto: { type: "integer", minimum: 0, maximum: 20 },
                  qualidade_visual: { type: "integer", minimum: 0, maximum: 20 },
                  clareza_mensagem: { type: "integer", minimum: 0, maximum: 20 },
                  legibilidade_texto_legenda: { type: "integer", minimum: 0, maximum: 20 },
                  potencial_engajamento: { type: "integer", minimum: 0, maximum: 20 },
                },
              },
              score_viralizacao: { type: "integer", minimum: 0, maximum: 100 },
              resumo: { type: "string" },
              pontos_fortes: { type: "array", items: { type: "string" } },
              pontos_fracos: { type: "array", items: { type: "string" } },
              melhorias_praticas: { type: "array", items: { type: "string" } },
              ganchos: { type: "array", items: { type: "string" } },
              legendas: { type: "array", items: { type: "string" } },
              hashtags: { type: "array", items: { type: "string" } },
            },
          },
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

    // ✅ devolve o erro REAL da OpenAI pro front (para você enxergar)
    if (!r.ok) {
      return send(res, r.status, {
        error: "OpenAI API error",
        status: r.status,
        details: raw,
      });
    }

    const data = safeJsonParse(raw);
    if (!data) {
      return send(res, 500, {
        error: "Resposta da OpenAI não veio em JSON",
        details: raw.slice(0, 2000),
      });
    }

    const text = extractOutputText(data);
    if (!text) {
      return send(res, 500, {
        error: "OpenAI não retornou output_text",
        details: JSON.stringify(data).slice(0, 2000),
      });
    }

    const result = safeJsonParse(text);
    if (!result) {
      return send(res, 500, {
        error: "OpenAI retornou texto que não é JSON",
        details: text.slice(0, 2000),
      });
    }

    // 🔒 score determinístico = soma dos critérios
    const c = result.criterios;
    if (c) {
      result.score_viralizacao =
        Number(c.hook_impacto ?? 0) +
        Number(c.qualidade_visual ?? 0) +
        Number(c.clareza_mensagem ?? 0) +
        Number(c.legibilidade_texto_legenda ?? 0) +
        Number(c.potencial_engajamento ?? 0);
    }

    await blobPut(cachePath, { result });

    return send(res, 200, { result, cached: false });
  } catch (err: any) {
    return send(res, 500, {
      error: "Erro interno na Function",
      details: err?.message || String(err),
    });
  }
}
