import type { VercelRequest, VercelResponse } from "@vercel/node";

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

  // base64 puro (sem prefixo)
  if (/^[A-Za-z0-9+/=]+$/.test(s)) {
    const isPng = s.startsWith("iVBOR");
    const mime = isPng ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${s}`;
  }

  return "";
}

/* =========================
   RESPONSES API OUTPUT TEXT
========================= */
function extractOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }
  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (item?.type === "message" && Array.isArray(item?.content)) {
        for (const part of item.content) {
          if (
            part?.type === "output_text" &&
            typeof part?.text === "string" &&
            part.text.trim()
          ) {
            return part.text;
          }
        }
      }
    }
  }
  return "";
}

/* =========================
   VERCEL KV (Upstash Redis)
   ENV:
   - KV_REST_API_URL
   - KV_REST_API_TOKEN
========================= */
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet<T>(key: string): Promise<T | null> {
  if (!KV_URL || !KV_TOKEN) return null;

  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });

  if (!r.ok) return null;
  const j = await r.json();

  if (j?.result == null) return null;

  try {
    return typeof j.result === "string" ? (JSON.parse(j.result) as T) : (j.result as T);
  } catch {
    return j.result as T;
  }
}

async function kvSet(key: string, value: any, ttlSeconds = 60 * 60 * 24 * 30) {
  if (!KV_URL || !KV_TOKEN) return;

  const stringValue = JSON.stringify(value);

  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(stringValue),
  });

  await fetch(`${KV_URL}/expire/${encodeURIComponent(key)}/${ttlSeconds}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

/* =========================
   HANDLER
========================= */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return send(res, 405, { error: "Método não permitido. Use POST." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return send(res, 500, {
        error: "OPENAI_API_KEY não configurada",
        details: "Vercel → Project Settings → Environment Variables → OPENAI_API_KEY",
      });
    }

    // KV é obrigatório para manter o mesmo score sempre
    if (!KV_URL || !KV_TOKEN) {
      return send(res, 500, {
        error: "Vercel KV não configurado",
        details:
          "Crie um KV no Vercel (Storage → KV) e conecte ao projeto para gerar KV_REST_API_URL e KV_REST_API_TOKEN.",
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

    // ✅ 1) SE JÁ EXISTE, RETORNA IGUAL
    const key = `viracheck:analysis:${video_hash}`;
    const cached = await kvGet<any>(key);
    if (cached?.result) {
      return send(res, 200, { result: cached.result, cached: true });
    }

    // ✅ 2) SE NÃO EXISTE, ANALISA NORMAL
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

Use os FRAMES e metadados para diferenciar vídeos.
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

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      return send(res, resp.status, { error: "Falha na OpenAI API", details: raw.slice(0, 2000) });
    }

    const data = JSON.parse(raw);
    const out = extractOutputText(data);
    if (!out) {
      return send(res, 500, { error: "OpenAI não retornou texto", details: JSON.stringify(data).slice(0, 1400) });
    }

    const result = JSON.parse(out);

    // valida soma
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

    // ✅ 3) SALVA PARA RETORNAR IGUAL SEMPRE
    await kvSet(key, { result });

    return send(res, 200, { result, cached: false });
  } catch (err: any) {
    return send(res, 500, { error: "Erro interno da Function", details: err?.message || String(err) });
  }
}

