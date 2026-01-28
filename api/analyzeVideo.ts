import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

type AnalyzeReq = {
  platform?: string;
  hook?: string;
  description?: string;
  frames?: string[]; // base64 data URLs: "data:image/jpeg;base64,..."
  fingerprint?: string; // opcional, do client
};

const CACHE = new Map<string, { ts: number; data: any }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1h

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function json(res: VercelResponse, status: number, body: any) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(body));
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
      return json(res, 405, { error: "Método não permitido. Use POST." });
    }

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return json(res, 500, {
        error:
          "OPENAI_API_KEY não configurada. Configure em Vercel > Settings > Environment Variables e faça redeploy.",
      });
    }

    const body = (req.body || {}) as AnalyzeReq;
    const platform = body.platform || "Todas";
    const hook = (body.hook || "").trim();
    const description = (body.description || "").trim();
    const frames = Array.isArray(body.frames) ? body.frames.slice(0, 8) : [];

    if (frames.length === 0) {
      return json(res, 400, { error: "Envie pelo menos 1 frame (imagem) do vídeo." });
    }

    cleanupCache();

    const stableKey =
      body.fingerprint?.trim() ||
      sha256(
        JSON.stringify({
          platform,
          hook,
          description,
          // usar só o começo dos frames pra reduzir custo de hash
          framesHead: frames.map((f) => f.slice(0, 120)),
        })
      );

    const cached = CACHE.get(stableKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return json(res, 200, { cached: true, fingerprint: stableKey, result: cached.data });
    }

    // Monta prompt
    const system = `
Você é um especialista em viralização (TikTok, Reels, Shorts) e copywriting.
Responda SEMPRE em português do Brasil.
Seja direto, prático e objetivo.`;

    const userText = `
Analise os frames do vídeo (são capturas do conteúdo).
Plataforma: ${platform}
Gancho sugerido (opcional): ${hook || "(não informado)"}
Descrição (opcional): ${description || "(não informada)"}

Quero um diagnóstico + melhorias:
- Pontos fortes
- Pontos fracos
- Sugestões práticas (edição, ritmo, cortes, legendas, áudio, enquadramento)
- 5 ideias de gancho (curtas e agressivas)
- 5 ideias de legenda (PT-BR)
- 15 hashtags (PT-BR, sem # repetida)
- Nota de potencial de viralização (0 a 100)
`;

    // Content multimodal: texto + imagens
    const input = [
      {
        role: "system",
        content: [{ type: "input_text", text: system }],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: userText },
          ...frames.map((dataUrl) => ({
            type: "input_image",
            image_url: dataUrl,
          })),
        ],
      },
    ];

    // Respostas estruturadas via text.format (Responses API)
    // Em vez de response_format, usa text.format. :contentReference[oaicite:1]{index=1}
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
        temperature: 0, // reduz variação
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
      return json(res, resp.status, {
        error: "Falha na OpenAI API",
        details: raw,
      });
    }

    const data = JSON.parse(raw);

    // O conteúdo pode vir em output_text (string JSON) dependendo do formato,
    // mas em structured outputs costuma vir já como texto válido JSON no output_text.
    // Vamos tentar extrair do jeito mais robusto possível.
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

    let result: any;
    try {
      result = outText ? JSON.parse(outText) : null;
    } catch {
      // fallback: se já veio como objeto em algum campo (raro)
      result = data;
    }

    if (!result || typeof result !== "object") {
      return json(res, 500, {
        error: "A IA não retornou JSON válido.",
        details: { outTextPreview: String(outText).slice(0, 500) },
      });
    }

    CACHE.set(stableKey, { ts: Date.now(), data: result });

    return json(res, 200, { cached: false, fingerprint: stableKey, result });
  } catch (e: any) {
    return json(res, 500, { error: "Erro interno", details: e?.message || String(e) });
  }
}
