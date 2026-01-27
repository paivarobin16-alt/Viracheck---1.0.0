import OpenAI from "openai";

export async function handler(event: any) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Método não permitido. Use POST." }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "OPENAI_API_KEY não configurada." }),
      };
    }

    const client = new OpenAI({ apiKey });

    const body = JSON.parse(event.body || "{}");
    const platform = body.platform || "Todas";
    const duration = Number(body.duration || 0);
    const hook = String(body.hook || "");
    const description = String(body.description || "");

    const prompt = `
Você é um especialista em vídeos virais para TikTok, Instagram Reels e YouTube Shorts.
Responda APENAS com um JSON válido.

DADOS DO VÍDEO:
- Plataforma: ${platform}
- Duração: ${duration} segundos
- Gancho inicial: ${hook}
- Descrição do vídeo: ${description}

FORMATO:
{
  "score": 0,
  "strengths": [],
  "weaknesses": [],
  "improvements": [],
  "title": "",
  "caption": "",
  "cta": ""
}

Regras:
- Português do Brasil
- Seja direto e prático
- Pense em viralização
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";

    // Garante que retorna JSON válido
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: text.trim(),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || "Erro interno" }),
    };
  }
}
