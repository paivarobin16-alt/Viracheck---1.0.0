import OpenAI from "openai";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY não configurada no Vercel" });
    }

    const client = new OpenAI({ apiKey });

    const { platform, duration, hook, description, frames } = req.body || {};
    const framesArr: string[] = Array.isArray(frames) ? frames : [];
    const framesLimited = framesArr.slice(0, 6);

    const content: any[] = [
      {
        type: "input_text",
        text: `
Você é especialista em vídeos virais para TikTok, Instagram Reels e YouTube Shorts.
Analise com base no texto e nos FRAMES enviados.

DADOS:
- Plataforma: ${platform ?? "Todas"}
- Duração: ${Number(duration ?? 0)} segundos
- Gancho: ${String(hook ?? "")}
- Descrição: ${String(description ?? "")}

Responda APENAS com um JSON válido no formato:
{
  "score": 0,
  "strengths": [],
  "weaknesses": [],
  "improvements": [],
  "title": "",
  "caption": "",
  "cta": "",
  "frame_insights": []
}
`.trim(),
      },
      ...framesLimited.map((img) => ({
        type: "input_image",
        image_url: img,
        detail: "low",
      })),
    ];

    // ✅ IMPORTANTE: tipa como `any` para evitar TS2769 (overload)
    const request: any = {
      model: "gpt-4o-mini",
      input: [{ role: "user", content }],

      // ✅ JSON schema no lugar certo (Responses API)
      text: {
        format: {
          type: "json_schema",
          json_schema: {
            name: "viracheck_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                score: { type: "integer", minimum: 0, maximum: 100 },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                improvements: { type: "array", items: { type: "string" } },
                title: { type: "string" },
                caption: { type: "string" },
                cta: { type: "string" },
                frame_insights: { type: "array", items: { type: "string" } }
              },
              required: [
                "score",
                "strengths",
                "weaknesses",
                "improvements",
                "title",
                "caption",
                "cta",
                "frame_insights"
              ]
            }
          }
        }
      },

      temperature: 0.7,
    };

    const response: any = await client.responses.create(request);

    const text = String(response.output_text || "").trim();
    const parsed = JSON.parse(text);

    return res.status(200).json(parsed);
  } catch (err: any) {
    console.error("Analyze error:", err);
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}
