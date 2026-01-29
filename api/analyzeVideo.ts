import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// cache simples em memória (mesmo vídeo = mesmo score)
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

    const ai = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_output_tokens: 1000,
      input: [
        {
          role: "system",
          content: `
Você é um especialista em viralização de vídeos curtos (TikTok, Reels, Shorts).
Avalie de forma CRÍTICA, REALISTA e PRÁTICA.
Nada de respostas genéricas.
`,
        },
        {
          role: "user",
          content: `
Analise um vídeo curto (até 60s) com base nos critérios abaixo (0 a 10):

- Gancho inicial
- Clareza da mensagem
- Emoção gerada
- Uso de tendência
- Ritmo/dinamismo
- Chamada para ação (CTA)

Regras:
- Seja honesto (vídeos medianos devem ter score baixo)
- Justifique o score
- Pense como algoritmo de rede social

Calcule o score final assim:
Gancho*2.5 + Clareza*2 + Emoção*2 + Tendência*1.5 + Ritmo*1 + CTA*1

Retorne APENAS JSON válido neste formato:

{
  "score": number,
  "avaliacao": {
    "gancho": number,
    "clareza": number,
    "emocao": number,
    "tendencia": number,
    "ritmo": number,
    "cta": number
  },
  "resumo": string,
  "pontos_fortes": string[],
  "pontos_fracos": string[],
  "melhorias_praticas": string[],
  "ganchos_sugeridos": string[],
  "legendas_sugeridas": string[],
  "hashtags": string[],
  "musicas_recomendadas": string[],
  "observacoes": string
}

Idioma: PT-BR.
`,
        },
      ],
    });

    const raw = ai.output_text || "";
    const parsed = extractJSON(raw);

    if (!parsed || typeof parsed.score !== "number") {
      return res.status(500).json({
        error: "Resposta inválida da IA",
        raw,
      });
    }

    cache.set(video_fingerprint, parsed);
    return res.status(200).json({ cached: false, result: parsed });
  } catch (err: any) {
    return res.status(500).json({
      error: "Erro na OpenAI API",
      details: err.message,
    });
  }
}
