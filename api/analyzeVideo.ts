import type { VercelRequest, VercelResponse } from "@vercel/node";

/* -------------------- helpers -------------------- */
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

function extractOutputText(data: any): string {
  // 1) Caminho curto (às vezes existe)
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  // 2) Caminho robusto (como no seu log):
  // data.output -> [{ type:"message", content:[{ type:"output_text", text:"..." }] }]
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

/* -------------------- handler -------------------- */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return send(res, 405, { error: "Método não permitido. Use POST." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return send(res, 500, {
        error: "OPENAI_API_KEY não configurada",
        details:
          "Vercel > Project Settings > Environment Variables > OPENAI_API_KEY (Production) e faça redeploy.",
      });
    }

    const body = parseBody(req);

    const platform = String(body.platform || "Todas");
    const hook = String(body.hook || "");
    const description = String(body.description || "");
    const frames: string[] = Array.isArray(body.frames) ? body.frames : [];

    if (!frames.length) {
      return send(res, 400, { error: "Envie pelo menos 1 frame do vídeo." });
    }

    // Proteção contra payload grande
    if (frames.length > 6) {
      return send(res, 400, { error: "Muitos frames enviados", details: "Envie no máximo 6 frames." });
    }

    const system =
      "Você é especialista em viralização (TikTok, Reels, Shorts). Responda SEMPRE em pt-BR, prático e direto.";

    const userText = `
Plataforma: ${platform}
Gancho (opcional): ${hook}
Descrição (opcional): ${description}

Analise os frames do vídeo e gere recomendações para aumentar viralização.
Responda EXCLUSIVAMENTE em JSON conforme o schema.
`;

    const input = [
      { role: "system", content: [{ type: "input_text", text: system }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: userText },
          ...frames.map((img) => ({
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

    const payload = {
      model: "gpt-4o-mini",
      temperature: 0,
      max_output_tokens: 900,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "viracheck_analysis", // obrigatório
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
      console.error("OpenAI error:", raw);
      return send(res, resp.status, {
        error: "Falha na OpenAI API",
        status: resp.status,
        details: raw.slice(0, 2000),
      });
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("Resposta não-JSON:", raw);
      return send(res, 500, { error: "Resposta inválida da OpenAI", details: raw.slice(0, 500) });
    }

    const out = extractOutputText(data);
    if (!out) {
      return send(res, 500, {
        error: "OpenAI não retornou texto em output_text nem em output[].content[].text",
        details: JSON.stringify(data).slice(0, 1200),
      });
    }

    let result: any;
    try {
      result = JSON.parse(out);
    } catch {
      return send(res, 500, {
        error: "A IA não retornou JSON válido",
        details: String(out).slice(0, 1200),
      });
    }

    return send(res, 200, { result });
  } catch (err: any) {
    console.error("Function crash:", err);
    return send(res, 500, { error: "Erro interno da Function", details: err?.message || String(err) });
  }
}
