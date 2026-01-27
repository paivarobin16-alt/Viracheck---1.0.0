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

    const prompt =
      `Você é especialista em vídeos virais (TikTok, Reels, Shorts).\n` +
      `Analise com base no texto e nos FRAMES (imagens) enviados.\n` +
      `Responda seguindo o schema.\n\n` +
      `DADOS:\n` +
      `- Plataforma: ${platform ?? "Todas"}\n` +
      `- Duração: ${Number(duration ?? 0)}s\n` +
      `- Gancho: ${String(hook ?? "")}\n` +
      `- Descrição: ${String(description ?? "")}\n`;

    const content: any[] = [
      { type: "input_text", text: prompt },
      ...framesLimited.map((img) => ({
        type: "input_image",
        image_url: img, // data:image/jpeg;base64,...
        detail: "low",
      })),
    ];

    // ✅ Structured Outputs (schema) para garantir JSON válido
    // Recomendado pela OpenAI; strict=true força aderência ao schema. :contentReference[oaicite:1]{index=1}
    const response = await client.responses.create({
      // Use um modelo que suporte structured outputs; este é citado como compatível no anúncio. :contentReference[oaicite:2]{index=2}
      model: "gpt-4o-mini-2024-07-18",
      input: [{ role: "user", content }],
      response_format: {
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
      },
      temperature: 0.7
    });

    // Respostas com structured outputs vêm como JSON confiável
    const text = (response as any).output_text?.trim?.() ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // fallback muito raro com schema, mas deixo por segurança
      parsed = {
        score: 50,
        strengths: [],
        weaknesses: ["Falha ao parsear JSON (inesperado com schema)."],
        improvements: ["Tente novamente."],
        title: "Sugestão de título",
        caption: "Sugestão de legenda",
        cta: "Sugestão de CTA",
        frame_insights: [],
      };
    }

    return res.status(200).json(parsed);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}
