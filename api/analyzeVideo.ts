import type { VercelRequest, VercelResponse } from "@vercel/node";

/* =========================
   HELPERS
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

/** 🔒 Garante image_url válido para a OpenAI */
function normalizeImageUrl(input: any): string {
  if (!input) return "";

  const s = String(input).trim();

  // URL normal
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  // Data URL válido
  if (s.startsWith("data:image/")) return s;

  // Base64 puro → converte para data URL
  if (/^[A-Za-z0-9+/=]+$/.test(s)) {
    const isPng = s.startsWith("iVBOR");
    const mime = isPng ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${s}`;
  }

  return "";
}

/** Extrai output_text da Responses API */
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
   HANDLER
========================= */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "POST") {
      return send(res, 405, { error: "Método não permitido. Use POST." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return send(res, 500, {
        error: "OPENAI_API_KEY não configurada",
        details:
          "Configure em Vercel → Project Settings → Environment Variables",
      });
    }

    const body = parseBody(req);

    const framesRaw = Array.isArray(body.frames) ? body.frames : [];
    const videoMeta = body.video_meta || {};
    const videoHash = String(body.video_hash || "");

    // Normaliza frames (aceita {image} ou string)
    const normalizedImages = framesRaw
      .map((f: any) => normalizeImageUrl(f?.image ?? f))
      .filter(Boolean);

    if (!normalizedImages.length) {
      return send(res, 400, {
        error: "Nenhum frame válido foi recebido",
        details:
          "Os frames não estavam em formato de imagem válido (data:image ou base64).",
      });
    }

    if (normalizedImages.length > 8) {
      return send(res, 400, {
        error: "Muitos frames",
        details: "Envie no máximo 8 frames.",
      });
    }

    /* =========================
       PROMPT
    ========================= */
    const system = `
Você é especialista em viralização (TikTok, Reels, Shorts).
Responda SEMPRE em português do Brasil.

REGRA OBRIGATÓRIA:
- O score final DEVE ser a soma de 5 critérios (0..20 cada):
  hook_impacto,
  qualidade_visual,
  clareza_mensagem,
  legibilidade_texto_legenda,
  potencial_engajamento.

IMPORTANTE:
- Use frames + metadados do vídeo para diferenciar vídeos.
- Vídeos diferentes NÃO devem ter sempre o mesmo score.
- Retorne SOMENTE JSON no formato exigido.
`;

    const userText = `
Identificador do vídeo (hash): ${videoHash || "não informado"}

Metadados do vídeo:
${JSON.stringify(videoMeta, null, 2)}

Tarefa:
1) Analise os frames enviados.
2) Avalie os 5 critérios (0..20).
3) Some e gere score_viralizacao (0..100).
4) Gere sugestões práticas (ganchos, legendas, hashtags).
`;

    const input: any[] = [
      { role: "system", content: [{ type: "input_text", text: system }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: userText },
          ...normalizedImages.map((img) => ({
            type: "input_image",
            image_url: img,
          })),
        ],
      },
    ];

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
            legibilidade_texto_legenda: {
              type: "integer",
              minimum: 0,
              maximum: 20,
            },
            potencial_engajamento: {
              type: "integer",
              minimum: 0,
              maximum: 20,
            },
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
      input,
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
      return send(res, resp.status, {
        error: "Falha na OpenAI API",
        details: raw.slice(0, 2000),
      });
    }

    const data = JSON.parse(raw);
    const out = extractOutputText(data);

    if (!out) {
      return send(res, 500, {
        error: "OpenAI não retornou texto válido",
        details: JSON.stringify(data).slice(0, 1500),
      });
    }

    const result = JSON.parse(out);

    // 🔎 valida soma
    const c = result.criterios || {};
    const sum =
      (Number(c.hook_impacto) || 0) +
      (Number(c.qualidade_visual) || 0) +
      (Number(c.clareza_mensagem) || 0) +
      (Number(c.legibilidade_texto_legenda) || 0) +
      (Number(c.potencial_engajamento) || 0);

    if (result.score_viralizacao !== sum) {
      result.score_viralizacao = Math.max(0, Math.min(100, sum));
      result.observacoes = `${
        result.observacoes || ""
      } (Score ajustado automaticamente pela soma dos critérios.)`.trim();
    }

    return send(res, 200, { result });
  } catch (err: any) {
    return send(res, 500, {
      error: "Erro interno da Function",
      details: err?.message || String(err),
    });
  }
}
