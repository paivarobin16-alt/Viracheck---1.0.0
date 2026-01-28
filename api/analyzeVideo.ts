import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

type AnalyzeReq = {
  platform?: string;
  hook?: string;
  description?: string;
  frames?: string[];
  fingerprint?: string;
};

const CACHE = new Map<string, { ts: number; data: any }>();
const CACHE_TTL_MS = 1000 * 60 * 60;

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function send(res: VercelResponse, status: number, body: any) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function cleanupCache() {
  const now = Date.now();
  for (const [k, v] of CACHE.entries()) {
    if (now - v.ts > CACHE_TTL_MS) CACHE.delete(k);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return send(res, 405, { error: "Método não permitido. Use POST." });
    }

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return send(res, 500, {
        error: "OPENAI_API_KEY não configurada na Vercel.",
        details:
          "Vercel > Project Settings > Environment Variables > OPENAI_API_KEY (Production) e faça Redeploy.",
      });
    }

    const body = (req.body || {}) as AnalyzeReq;
    const platform = body.platform || "Todas";
    const hook = (body.hook || "").trim();
    const description = (body.description || "").trim();
    const frames = Array.isArray(body.frames) ? body.frames.slice(0, 8) : [];

    if (frames.length === 0) {
      return send(res, 400, { error: "Envie pelo menos 1 frame do vídeo." });
    }

    cleanupCache();

    const stableKey =
      body.fingerprint?.trim() ||
      sha256(
        JSON.stringify({
          platform,
          hook,
          description,
          framesHead: frames.map((f) => f.slice(0, 120)),
        })
      );

    const cached = CACHE.get(stableKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return send(res, 200, { cached: true, fingerprint: stableKey, result: cached.data });
    }

    const system =
      "Você é especialista em viralização (TikTok, Reels, Shorts) e copywriting. Responda sempre em pt-BR, direto e prático.";

    const userText = `
Analise os frames do vídeo (capturas).
Plataforma: ${platform}
Gancho sugerido: ${hook || "(não informado)"}
Descrição: ${description || "(não informada)"}

Retorne:
- Pontos fortes
- Pontos fracos
- Sugestões práticas
- 5 ganchos
- 5 legendas
- 15 hashtags
- Nota 0 a 100
`;

    const input = [
      { role: "system", content: [{ type: "input_text", text: system }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: userText },
          ...frames.map((dataUrl) => ({
            type: "input_image",
            image_url: dataUrl, // data URL é aceito
          })),
        ],
      },
    ];

    const schema = {
      name: "viracheck_analysis",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          score_viralizacao: { type: "integer", minimum: 0, maximum: 100 },
          resumo: { type: "string" },
          pontos_fortes: { type: "array", items: { type: "string" }, minItems: 3 },
          pontos_fracos: { type: "array", items: { type: "string" }, minItems: 3 },
          melhorias_praticas: { type: "array", items: { type: "string" }, minItems: 6 },
          ganchos: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
          legendas: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
          hashtags: { type: "array", items: { type: "string" }, minItems: 10, maxItems: 20 },
          observacoes: { type: "string" },
        },
        required: [
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
      },
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input,
        temperature: 0,
        top_p: 1,
        max_output_tokens: 900,
        text: {
          format: {
            type: "json_schema",
            json_schema: schema,
          },
        },
      }),
    });

    const raw = await resp.text();

    if (!resp.ok) {
      // devolve o erro REAL (é isso que você precisa ver no front)
      return send(res, resp.status, {
        error: "Falha na OpenAI API",
        status: resp.status,
        details: raw.slice(0, 2000),
      });
    }

    const data = JSON.parse(raw);

    let outText = "";
    try {
      outText = data.output_text || "";
      if (!outText && Array.isArray(data.output)) {
        for (const item of data.output) {
          if (item?.type === "message") {
            const parts = item?.content || [];
            for (const p of parts) {
              if (p?.type === "output_text" && typeof p.text === "string") outText += p.text;
            }
          }
        }
      }
    } catch {}

    let result: any = null;
    try {
      result = outText ? JSON.parse(outText) : null;
    } catch {
      return send(res, 500, {
        error: "A IA não retornou JSON válido",
        details: String(outText).slice(0, 800),
      });
    }

    CACHE.set(stableKey, { ts: Date.now(), data: result });

    return send(res, 200, { cached: false, fingerprint: stableKey, result });
  } catch (e: any) {
    return send(res, 500, { error: "Erro interno", details: e?.message || String(e) });
  }
}

