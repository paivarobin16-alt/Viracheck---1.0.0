import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// cache simples (serverless-safe)
const memoryCache = new Map<string, any>();

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

    // ✅ Se já analisou, retorna igual
    if (memoryCache.has(video_hash)) {
      return res.status(200).json({
        cached: true,
        result: memoryCache.get(video_hash),
      });
    }

    // 🎯 Seed determinística
    const seed = video_hash
      .split("")
      .reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0, // 🔒 determinístico
      max_output_tokens: 800,
      input: [
        {
          role: "system",
          content:
            "Você é um especialista em análise de viralização de vídeos curtos para redes sociais.",
        },
        {
          role: "user",
          content: `
Analise um vídeo curto com base em metadados.
Use o seed ${seed} para gerar um score consistente.

Retorne SOMENTE JSON válido no formato:

{
  "score_viralizacao": number (0-100),
  "resumo": string,
  "pontos_fortes": string[],
  "pontos_fracos": string[],
  "melhorias_praticas": string[],
  "ganchos": string[],
  "legendas": string[],
  "hashtags": string[],
  "observacoes": string
}

Idioma: Português Brasil.
`,
        },
      ],
    });

    const output =
      response.output?.[0]?.content?.[0]?.text ||
      response.output_text ||
      null;

    if (!output) {
      return res
        .status(500)
        .json({ error: "OpenAI não retornou resposta válida" });
    }

    let parsed;
    try {
      parsed = JSON.parse(output);
    } catch {
      return res.status(500).json({
        error: "Resposta inválida da IA",
        raw: output,
      });
    }

    // 💾 Salva no cache
    memoryCache.set(video_hash, parsed);

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
