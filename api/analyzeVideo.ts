import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// cache simples em memória (mesmo vídeo = mesmo resultado)
const cache = new Map<string, any>();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { video_hash, duration, size, orientation } = req.body;

    if (!video_hash) {
      return res.status(400).json({ error: "video_hash obrigatório" });
    }

    // mesmo vídeo → mesmo resultado
    if (cache.has(video_hash)) {
      return res.json({ cached: true, result: cache.get(video_hash) });
    }

    // score determinístico baseado em dados reais
    let score = 50;

    if (orientation === "vertical") score += 15;
    if (duration <= 30) score += 10;
    if (duration > 30 && duration <= 60) score += 5;
    if (size < 20_000_000) score += 5; // vídeo leve
    if (score > 95) score = 95;

    const ai = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_output_tokens: 600,
      input: [
        {
          role: "system",
          content:
            "Você é um especialista em viralização de vídeos curtos para redes sociais.",
        },
        {
          role: "user",
          content: `
O vídeo possui:
- Duração: ${duration}s
- Orientação: ${orientation}
- Tamanho: ${(size / 1_000_000).toFixed(1)}MB

Gere sugestões realistas e coerentes.
Retorne APENAS JSON válido no formato:

{
  "score_viralizacao": number,
  "resumo": string,
  "pontos_fortes": string[],
  "pontos_fracos": string[],
  "melhorias_praticas": string[],
  "musicas_recomendadas": string[]
}
`,
        },
      ],
    });

    const raw = ai.output_text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON inválido");

    const parsed = JSON.parse(jsonMatch[0]);
    parsed.score_viralizacao = score;

    cache.set(video_hash, parsed);

    return res
