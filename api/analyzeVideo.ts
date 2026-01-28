import type { VercelRequest, VercelResponse } from "@vercel/node";

function json(res: VercelResponse, status: number, data: any) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function safeParseBody(req: VercelRequest): any {
  // Vercel às vezes entrega req.body como objeto, às vezes como string
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Método não permitido. Use POST." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(res, 500, {
        error: "OPENAI_API_KEY não configurada na Vercel.",
        details: "Vercel > Project Settings > Environment Variables > OPENAI_API_KEY (Production) e redeploy.",
      });
    }

    const body = safeParseBody(req);

    const platform = String(body.platform || "Todas");
    const hook = String(body.hook || "");
    const description = String(body.description || "");
    const frames = Array.isArray(body.frames) ? body.frames : [];

    if (!frames.length) {
      return json(res, 400, { error: "Envie frames (imagens) do vídeo." });
    }

    // ✅ Proteção: se vier payload absurdo, avisa logo (evita crash)
    if (frames.length > 6) {
      return json(res, 400, {
        error: "Muitos frames enviados.",
        details: "Envie no máximo 6 frames.",
      });
    }

    // ✅ Prompt (PT-BR)
    const system =
      "Você é especialista em viralização (TikTok, Reels, Shorts). Responda SEMPRE em pt-BR. Seja direto e prático.";
    const userText = `
Plataforma: ${platform}
Gancho (opcional): ${hook}
Descrição (opcional): ${description}

Analise os frames do vídeo e retorne JSON seguindo o schema.
`;

    // ✅ Schema
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
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

    const input = [
      { role: "system", content: [{ type: "input_text", text: system }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: userText },
          ...frames.map((dataUrl: string) => ({
            type: "input_image",
            image_url: dataUrl,
          })),
        ],
      },
    ];

    // ✅ Chamada correta (com name obrigatório)
    const payload = {
      model: "gpt-4o-mini",
      input,
      temperature: 0,
      max_output_tokens: 900,
      text: {
        format: {
          type: "json_schema",
          name: "viracheck_analysis", // ✅ obrigatório
          strict: true,
          schema, // ✅ schema aqui (não embrulha outro objeto)
        },
      },
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
       n        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();

    if (!resp.ok) {
      console.error("OpenAI error:", raw);
      return json(res, resp.status, {
        error: "Falha na OpenAI API",
        status: resp.status,
        details: raw.slice(0, 2000),
      });
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("JSON parse failed:", raw);
      return json(res, 500, { error: "Resposta da OpenAI não é JSON", details: raw.slice(0, 500) });
    }

    const outText = data.output_text || "";
    let result: any;

    try {
      result = JSON.parse(outText);
    } catch (e) {
      console.error("Model returned non-JSON:", outText);
      return json(res, 500, {
        error: "A IA não retornou JSON válido",
        details: String(outText).slice(0, 800),
      });
    }

    return json(res, 200, { result });
  } catch (err: any) {
    // ✅ Essa linha faz aparecer o erro REAL nos logs da Vercel
    console.error("Function crash:", err);
    return json(res, 500, { error: "Erro interno da Function", details: err?.message || String(err) });
  }
}

