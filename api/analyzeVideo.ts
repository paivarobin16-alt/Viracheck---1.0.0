import OpenAI from "openai";

type CachedValue = {
  value: any;
  expiresAt: number;
};

const CACHE = new Map<string, CachedValue>();

function getCache(key: string) {
  const hit = CACHE.get(key);
  if (!hit) return null;

  if (Date.now() > hit.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return hit.value;
}

function setCache(key: string, value: any, ttlMs: number) {
  CACHE.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY não configurada no Vercel" });

    const client = new OpenAI({ apiKey });

    const { platform, duration, hook, description, frames, fingerprint } = req.body || {};

    if (!fingerprint || typeof fingerprint !== "string") {
      return res.status(400).json({ error: "fingerprint obrigatório" });
    }

    const cached = getCache(fingerprint);
    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    const framesArr: string[] = Array.isArray(frames) ? frames : [];
    const framesLimited = framesArr.slice(0, 6);

    const content: any[] = [
      {
        type: "input_text",
        text: `
Você é especialista em vídeos virais (TikTok, Reels, Shorts).
Analise com base no texto e nos FRAMES enviados.
Responda em Português do Brasil.

Retorne APENAS um JSON neste formato:
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

DADOS:
- Plataforma: ${platform ?? "Todas"}
- Duração: ${Number(duration ?? 0)} segundos
- Gancho: ${String(hook ?? "")}
- Descrição: ${String(description ?? "")}
`.trim(),
      },
      ...framesLimited.map((img) => ({
        type: "input_image",
        image_url: img,
        detail: "low",
      })),
    ];

    const request: any = {
      model: "gpt-4o-mini-2024-07-18",
      input: [{ role: "user", content }],
      temperature: 0,

      text: {
        format: {
          type: "json_schema",
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
              frame_insights: { type: "array", items: { type: "string" } },
            },
            required: [
              "score",
              "strengths",
              "weaknesses",
              "improvements",
              "title",
              "caption",
              "cta",
              "frame_insights",
            ],
          },
        },
      },
    };

    const response: any = await client.responses.create(request);

    const out = String(response.output_text || "").trim();
    const parsed = JSON.parse(out);

    setCache(fingerprint, parsed, 7 * 24 * 60 * 60 * 1000);

    return res.status(200).json({ ...parsed, cached: false });
  } catch (err: any) {
    console.error("Analyze error:", err);
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}
