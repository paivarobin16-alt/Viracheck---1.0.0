import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// cache simples por hash
const cache = new Map<string, any>();

function extractJSON(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { video_hash } = req.body;

    if (!video_hash) {
      return res.status(400).json({ error: "video_hash obrigatório" });
    }

    // ✅ mesmo vídeo → mesmo resultado
    if (cache.has(video_hash)) {
      return res.status(200).json({
        cached: true,
        result: cache.get(video_hash),
      });
    }

    // seed determinístico
    const seed = video_hash
      .split("")
      .reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);

    const ai = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_output_tokens: 900,
      input: [
        {
          role: "system",
          content:
            "Você é um especialista em viralização de vídeos curtos para TikTok, Reels e Shorts.",
        },
        {
          role: "user",
          content: `
Use o seed ${seed} para gerar um resultado CONSISTENTE.

Retorne APENAS JSON válido no formato:

{
  "score_viralizacao": number,
  "resumo": string,
  "pontos_fortes": string[],
  "pontos_fracos": string[],
  "melhorias_praticas": string[],
  "ganchos": string[],
  "legendas": string[],
  "hashtags": string[],
  "musicas_recomendadas": string[],
  "observacoes": string
}

Idioma: Português Brasil.
`,
        },
      ],
    });

    const raw =
      ai.output_text ||
      ai.output?.[0]?.content?.[0]?.text ||
      "";

    const parsed = extractJSON(raw);

    if (!parsed || typeof parsed.score_viralizacao !== "number") {
      return res.status(500).json({
        error: "Resposta inválida da IA",
        raw,
      });
    }

    cache.set(video_hash, parsed);

    return res.status(200).json({
      cached: false,
      result: parsed,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "Erro na OpenAI API",
      details: err.message,
    });
  }
}
