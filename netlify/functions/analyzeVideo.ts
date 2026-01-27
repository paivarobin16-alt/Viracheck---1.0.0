import OpenAI from "openai";

export const handler = async (event: any) => {
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
        body: JSON.stringify({
          error: "OPENAI_API_KEY não configurada no Netlify",
        }),
      };
    }

    const client = new OpenAI({ apiKey });

    const body = JSON.parse(event.body || "{}");
    const {
      duration,
      platform,
      description,
      hook,
    } = body;

    const prompt = `
Você é um especialista em vídeos virais para redes sociais (TikTok, Instagram Reels e YouTube Shorts).

Analise os dados abaixo e retorne APENAS um JSON válido no formato especificado.

DADOS DO VÍDEO:
- Plataforma: ${platform}
- Duração: ${duration} segundos
- Gancho inicial: ${hook}
- Descrição do vídeo: ${description}

RETORNE EXATAMENTE NESTE FORMATO JSON:
{
  "score": number (0 a 100),
  "strengths": string[],
  "weaknesses": string[],
  "improvements": string[],
  "title": string,
  "caption": string,
  "cta": string
}

Regras:
- Linguagem em português do Brasil
- Seja direto e prático
- Pense em viralização
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = completion.choices[0].message.content;

    return {
      statusCode: 200,
      body: text,
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err?.message || "Erro interno",
      }),
    };
  }
};
