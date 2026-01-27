import OpenAI from "openai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

export async function handler(event: any) {
  try {
    // Preflight CORS
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Método não permitido. Use POST." }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "OPENAI_API_KEY não configurada no Netlify." }),
      };
    }

    const client = new OpenAI({ apiKey });

    const body = JSON.parse(event.body || "{}");
    const platform = String(body.platform || "Todas");
    const duration = Number(body.duration || 0);
    const hook = String(body.hook || "");
    const description = String(body.description || "");

    const prompt = `
Você é um especialista em vídeos virais para TikTok, Instagram Reels e YouTube Shorts.
Responda APENAS com um JSON válido, sem texto fora do JSON.

DADOS DO VÍDEO:
- Plataforma: ${platform}
- Duração: ${duration} segundos
- Gancho inicial: ${hook}
- Descrição do vídeo: ${description}

RETORNE EXATAMENTE NESTE FORMATO JSON:
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
- "score" de 0 a 100
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";

    // Garante que é JSON
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // fallback caso o modelo devolva algo fora do JSON (raro, mas possível)
      parsed = {
        score: 50,
        strengths: ["Boa tentativa de análise, mas a resposta não veio no formato ideal."],
        weaknesses: ["A IA retornou um formato inválido."],
        improvements: ["Tente novamente com uma descrição mais detalhada do vídeo."],
        title: "Título sugerido",
        caption: "Legenda sugerida",
        cta: "CTA sugerido",
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(parsed),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || "Erro interno" }),
    };
  }
}
