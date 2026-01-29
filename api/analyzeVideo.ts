import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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
    const { video_hash } = req.body;
    if (!video_hash) {
      return res.status(400).json({ error: "video_hash obrigatório" });
    }

    if (cache.has(video_hash)) {
      return res.status(200).json({ cached: true, result: cache.get(video_hash) });
    }

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
          content: `
Você é um analista profissional de vídeos virais (TikTok, Reels, Shorts).
Avalie de forma CRÍTICA, REALISTA e OBJETIVA.
Não seja genérico.
`,
        },
        {
          role: "user",
          content: `
Considere que o vídeo é um short vertical (até 60s).

Avalie com base nos critérios abaixo (0–10 cada):

- gancho
- clareza_mensagem
- emocao
- tendencia
- ritmo
- cta

Use o seed ${seed} para consistência.

Calcule o score final assim:
gancho*2.5 + clareza*2 + emocao*2 + tendencia*1.5 + ritmo*1 + cta*1

Retorne APENAS JSON válido neste formato:

{
  "score_viralizacao": number,
  "criterios": {
    "gancho": number,
    "clareza": number,
    "emocao": number,
    "tendencia": number,
    "ritmo": number,
    "cta": number
  },
  "matematica_score": string,
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

Idioma: PT-BR.
`,
        },
      ],
    });

    const raw = ai.output_text || "";
    const parsed = extractJSON(raw);

    if (!parsed || typeof parsed.score_viralizacao !== "number") {
      return res.status(500).json({ error: "Resposta inválida da IA", raw });
    }

    cache.set(video_hash, parsed);
    return res.status(200).json({ cached: false, result: parsed });
  } catch (err: any) {
    return res.status(500).json({
      error: "Erro na OpenAI API",
      details: err.message,
    });
  }
}
