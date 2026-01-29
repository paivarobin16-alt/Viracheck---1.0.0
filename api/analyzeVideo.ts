import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// cache em memória (mesmo vídeo = mesmo score)
const cache = new Map<string, any>();

function safeParseJSON(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function isValidResult(obj: any) {
  return (
    obj &&
    typeof obj.score === "number" &&
    obj.score >= 0 &&
    obj.score <= 100 &&
    Array.isArray(obj.pontos_fortes) &&
    Array.isArray(obj.pontos_fracos) &&
    Array.isArray(obj.melhorias_praticas)
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { video_fingerprint } = req.body;

    if (!video_fingerprint) {
      return res.status(400).json({ error: "video_fingerprint obrigatório" });
    }

    // Retorna cache se já analisado
    if (cache.has(video_fingerprint)) {
      return res.status(200).json({
        cached: true,
        result: cache.get(video_fingerprint),
      });
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_output_tokens: 900,
      input: [
        {
          role: "system",
          content:
            "Você é um especialista em viralização de vídeos curtos. Seja crítico, honesto e técnico. NÃO escreva textos genéricos.",
        },
        {
          role: "user",
          content: `
Analise um vídeo curto (Reels, TikTok, Shorts) com base nos critérios:

- Gancho inicial (0–10)
- Clareza da mensagem (0–10)
- Emoção gerada (0–10)
- Uso de tendência (0–10)
- Ritmo e dinamismo (0–10)
- Chamada para ação (CTA) (0–10)

Cálculo do score:
Gancho*2.5 + Clareza*2 + Emoção*2 + Tendência*1.5 + Ritmo*1 + CTA*1

Regras:
- Vídeos comuns devem ter score baixo
- Seja exigente como o algoritmo
- NÃO invente elogios

Retorne APENAS JSON puro no formato:

{
  "score": number,
  "resumo": string,
  "pontos_fortes": string[],
  "pontos_fracos": string[],
  "melhorias_praticas": string[],
  "musicas_recomendadas": string[]
}

Idioma: PT-BR
`,
        },
      ],
    });

    const rawText = response.output_text || "";
    const parsed = safeParseJSON(rawText);

    if (!isValidResult(parsed)) {
      return res.status(500).json({
        error: "Resposta inválida da IA",
        raw: rawText,
      });
    }

    cache.set(video_fingerprint, parsed);

    return res.status(200).json({
      cached: false,
      result: parsed,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "Falha na OpenAI API",
      details: err.message,
    });
  }
}
