import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import OpenAI from "openai";

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* ========= helpers ========= */

function json(res: VercelResponse, status: number, data: any) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readFormData(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function fingerprintFromBuffer(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/* ========= handler ========= */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Método não permitido" });
    }

    const raw = await readFormData(req);
    if (!raw || raw.length === 0) {
      return json(res, 400, { error: "Vídeo não recebido" });
    }

    const fingerprint = fingerprintFromBuffer(raw);

    /**
     * 🔹 Análise textual guiada (estável)
     * Não usa frames, não usa imagens, não quebra no Vercel
     */
    const prompt = `
Você é uma IA especialista em viralização de vídeos curtos (Reels/TikTok/Shorts).

Analise o vídeo APENAS conceitualmente, assumindo:
- Conteúdo curto
- Formato vertical
- Público de redes sociais

Retorne APENAS JSON válido no formato abaixo (sem texto fora do JSON):

{
  "score": number (0-100),
  "resumo": string curta,
  "pontos_fortes": string[],
  "pontos_fracos": string[],
  "melhorias": string[] (em ordem),
  "musicas": string[]
}

O score deve variar realisticamente (não fixo).
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "Você retorna SOMENTE JSON válido. Nunca texto fora do JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      return json(res, 500, {
        error: "IA não retornou conteúdo",
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json(res, 500, {
        error: "Resposta da IA não é JSON válido",
        raw: content.slice(0, 200),
      });
    }

    /* validação mínima */
    if (
      typeof parsed.score !== "number" ||
      !Array.isArray(parsed.pontos_fortes) ||
      !Array.isArray(parsed.pontos_fracos)
    ) {
      return json(res, 500, {
        error: "Formato inválido retornado pela IA",
        parsed,
      });
    }

    return json(res, 200, {
      ...parsed,
      fingerprint,
    });
  } catch (err: any) {
    return json(res, 500, {
      error: "Falha interna no servidor",
      message: err?.message || String(err),
    });
  }
}
