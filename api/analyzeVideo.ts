import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import crypto from "crypto";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function json(res: VercelResponse, status: number, data: any) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Método não permitido" });
    }

    const { fingerprint, duration, platform, hook, description } = req.body;

    if (!fingerprint) {
      return json(res, 400, { error: "Fingerprint ausente" });
    }

    const prompt = `
Você é especialista em viralização de vídeos curtos (Reels/TikTok/Shorts).

Dados do vídeo:
- Duração: ${duration || "desconhecida"}s
- Plataforma: ${platform || "todas"}
- Gancho: ${hook || "não informado"}
- Descrição: ${description || "não informada"}

Retorne APENAS JSON válido no formato:

{
  "score": number (0-100),
  "resumo": string,
  "pontos_fortes": string[],
  "pontos_fracos": string[],
  "melhorias": string[],
  "musicas": string[]
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "Retorne SOMENTE JSON válido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      return json(res, 500, { error: "IA não retornou conteúdo" });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json(res, 500, {
        error: "Resposta da IA não é JSON válido",
        raw: content,
      });
    }

    return json(res, 200, {
      ...parsed,
      fingerprint,
    });
  } catch (err: any) {
    return json(res, 500, {
      error: "Erro interno",
      message: err?.message || String(err),
    });
  }
}
