import type { VercelRequest, VercelResponse } from "@vercel/node";

/* =========================
   Helpers HTTP
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
   Image Normalizer
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
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

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
   Blob REST (cache por hash)
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
  return r.json();
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
    throw new Error(await r.text());
  }
}

/* =========================
   Handler
========================= */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return send(res, 405, { error: "Use POST" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return send(res, 500, { error: "OPENAI_API_KEY ausente" });
    }
    if (!BLOB_TOKEN) {
      return send(res, 500, { error: "BLOB_READ_WRITE_TOKEN ausente" });
    }

    const body = parseBody(req);
    const video_hash = String(body.video_hash || "");
    if (!video_hash) {
      return send(res, 400, { error: "video_hash obrigatório" });
    }

    // ✅ 1) Cache: se já analisado, retorna o MESMO resultado
    const cachePath = blobKey(video_hash);
    const cached = await blobGet(cachePath);
    if (cached?.result) {
      return send(res, 200, { result: cached.result, cached: true });
    }

    // ✅ 2) Normaliza frames
    const frames = (Array.isArray(body.frames) ? body.frames : [])
      .map((f: any) => normalizeImageUrl(f?.image ?? f))
      .filter(Boolean);

    if (!frames.length) {
      return send(res, 400, { error: "Nenhum frame válido" });
    }

    const system = `
Você é especialista em viralização (TikTok, Reels, Shorts).
Responda sempre em português do Brasil.

REGRA:
O score_viralizacao é a SOMA EXATA de:
hook_impacto, qualidade_visual, clareza_mensagem,
legibilidade_texto_legenda, potencial_engajamento (0–20 cada).

Retorne SOMENTE JSON.
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
            { type: "input_text", text: "Analise os frames do vídeo." },
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
    if (!r.ok) {
      return send(res, r.status, { error: "OpenAI error", details: raw });
    }

    const data = JSON.parse(raw);
    const text = extractOutputText(data);
    if (!text) {
      return send(res, 500, { error: "OpenAI não retornou texto" });
    }

    const result = JSON.parse(text);

    // 🔒 garante score determinístico
    const c = result.criterios;
    result.score_viralizacao =
      c.hook_impacto +
      c.qualidade_visual +
      c.clareza_mensagem +
      c.legibilidade_texto_legenda +
      c.potencial_engajamento;

    // ✅ 3) salva no blob
    await blobPut(cachePath, { result });

    return send(res, 200, { result, cached: false });
  } catch (err: any) {
    return send(res, 500, { error: "Erro interno", details: err.message });
  }
}

