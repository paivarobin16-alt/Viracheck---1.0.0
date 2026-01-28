import type { VercelRequest, VercelResponse } from "@vercel/node";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return send(res, 405, { error: "Método não permitido. Use POST." });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return send(res, 500, {
        error: "OPENAI_API_KEY não configurada",
        details: "Vercel > Project Settings > Environment Variables > OPENAI_API_KEY (Production) e faça redeploy.",
      });
    }

    const body = parseBody(req);
    const platform = String(body.platform || "Todas");
    const hook = String(body.hook || "");
    const description = String(body.description || "");
    const video_hash = String(body.video_hash || "");

    // frames agora são objetos: [{ t: number, image: "data:image/..." }, ...]
    const frames = Array.isArray(body.frames) ? body.frames : [];
    const video_meta = typeof body.video_meta === "object" && body.video_meta ? body.video_meta : {};

    if (!frames.length) return send(res, 400, { error: "Envie frames do vídeo." });
    if (frames.length > 8) return send(res, 400, { error: "Muitos frames", details: "Envie no máximo 8." });

    const system = `
Você é especialista em viralização (TikTok, Reels, Shorts).
Responda SEMPRE em pt-BR.

REGRA DO SCORE (obrigatório):
- Você DEVE calcular o score final (0..100) como soma de 5 critérios (0..20 cada):
  hook_impacto, qualidade_visual, clareza_mensagem, legibilidade_texto_legenda, potencial_engajamento.

IMPORTANTE:
- Use os FRAMES + timestamps + metadados do vídeo para diferenciar vídeos.
- Se 2 vídeos forem diferentes (hash, duração, frames, resolução, etc), as notas devem refletir diferenças reais.
- Se não houver legenda visível nos frames, legibilidade_texto_legenda deve ser menor.
- Se os frames forem muito parecidos/sem variação, reduza potencial_engajamento.
`;

    const userText = `
Plataforma: ${platform}
Gancho (opcional): ${hook}
Descrição (opcional): ${description}

Identificador do vídeo (hash): ${video_hash || "não informado"}

Metadados do vídeo:
${JSON.stringify(video_meta, null, 2)}

Frames enviados (cada um com timestamp):
${JSON.stringify(frames.map((f: any) => ({ t: f?.t, note: "imagem em input_image" })), null, 2)}

Tarefa:
1) Analise os frames (com seus timestamps) e os metadados do vídeo.
2) Dê notas (0..20) para:
   - hook_impacto
   - qualidade_visual
   - clareza_mensagem
   - legibilidade_texto_legenda
   - potencial_engajamento
3) Some tudo e retorne score_viralizacao = soma (0..100).
4) Retorne sugestões (pontos fortes/fracos, melhorias, ganchos, legendas, hashtags).
5) Retorne SOMENTE JSON conforme o schema.
`;

    const input: any[] = [
      { role: "system", content: [{ type: "input_text", text: system }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: userText },
          ...frames.map((f: any) => ({
            type: "input_image",
            image_url: String(f.image || ""),
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
            legibilidade_texto_legenda: { type: "integer", minimum: 0, maximum: 20 },
            potencial_engajamento: { type: "integer", minimum: 0, maximum: 20 },
          },
          required: ["hook_impacto", "qualidade_visual", "clareza_mensagem", "legibilidade_texto_legenda", "potencial_engajamento"],
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
      max_output_tokens: 980,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "viracheck_analysis_v2",
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
      return send(res, resp.status, { error: "Falha na OpenAI API", status: resp.status, details: raw.slice(0, 2000) });
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return send(res, 500, { error: "Resposta inválida da OpenAI", details: raw.slice(0, 800) });
    }

    const out = extractOutputText(data);
    if (!out) return send(res, 500, { error: "OpenAI não retornou output_text", details: JSON.stringify(data).slice(0, 1400) });

    let result: any;
    try {
      result = JSON.parse(out);
    } catch {
      return send(res, 500, { error: "A IA não retornou JSON válido", details: out.slice(0, 1200) });
    }

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
      result.observacoes = `${result.observacoes || ""} (Ajuste automático: score = soma dos critérios.)`.trim();
    }

    return send(res, 200, { result });
  } catch (err: any) {
    return send(res, 500, { error: "Erro interno da Function", details: err?.message || String(err) });
  }
}
