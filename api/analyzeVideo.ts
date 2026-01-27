import OpenAI from "openai";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY não configurada no Vercel" });

    const client = new OpenAI({ apiKey });

    const { platform, duration, hook, description, frames } = req.body || {};
    const framesArr: string[] = Array.isArray(frames) ? frames : [];
    const framesLimited = framesArr.slice(0, 6);

    const content: any[] = [
      {
        type: "input_text",
        text: `
Você é especialista em vídeos virais (TikTok, Reels, Shorts).
Analise com base no texto e nos FRAMES enviados.
Responda em Português do Brasil.
`.trim(),
      },
      {
        type: "input_text",
        text: `
DADOS:
- Plataforma: ${platform ?? "Todas"}
- Duração: ${Number(duration ?? 0)} segundos
- Gancho: ${String(hook ?? "")}
- Descrição: ${String(description ?? "")}
`.trim(),
      },
      ...framesLimited.map((img) => ({
        type: "input_image",
        image_url: img, // data:image/jpeg;base64,...
        detail: "low",
      })),
    ];

    // Tipado como any para evitar conflito de overload do TS
    const request: any = {
      // Use um snapshot compatível com JSON Schema no Structured Outputs :contentReference[oaicite:2]{index=2}
      model: "gpt-4o-mini-2024-07-18",
      input: [{ role: "user", content }],
      temperature: 0.7,

      // ✅ FORMATO CERTO NO Responses API: text.format com name+schema :contentReference[oaicite:3]{index=3}
      text: {
        format: {
          type: "json_schema",
          name: "viracheck_analysis", // ✅ obrigatório (corrige seu erro 400)
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

    return res.status(200).json(parsed);
  } catch (err: any) {
    console.error("Analyze error:", err);
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}
