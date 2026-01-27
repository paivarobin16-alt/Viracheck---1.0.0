import OpenAI from "openai";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY não configurada no Vercel" });

    const client = new OpenAI({ apiKey });

    const { platform, duration, hook, description, frames } = req.body || {};

    const framesArr: string[] = Array.isArray(frames) ? frames : [];
    const framesLimited = framesArr.slice(0, 6); // evita payload gigante

    const basePrompt = `
Você é especialista em vídeos virais para TikTok, Instagram Reels e YouTube Shorts.
Analise o vídeo com base no texto e nos FRAMES enviados (imagens do vídeo).

Responda APENAS com um JSON válido (sem texto fora do JSON) no formato:
{
  "score": 0,
  "strengths": [],
  "weaknesses": [],
  "improvements": [],
  "title": "",
  "caption": "",
  "cta": "",
  "frame_insights": []
}

Regras:
- Português do Brasil
- Score 0 a 100
- Seja direto e prático
- "frame_insights" deve citar elementos visuais percebidos nos frames (texto na tela, cenário, rosto, iluminação, etc.)
`;

    // Monta conteúdo multimodal (texto + imagens)
    const content: any[] = [
      {
        type: "input_text",
        text: `${basePrompt}

DADOS:
- Plataforma: ${platform ?? "Todas"}
- Duração: ${Number(duration ?? 0)}s
- Gancho: ${String(hook ?? "")}
- Descrição: ${String(description ?? "")}

Agora analise os frames abaixo:`,
      },
      ...framesLimited.map((img) => ({
        type: "input_image",
        image_url: img, // data:image/jpeg;base64,...
        detail: "low",
      })),
    ];

    // Responses API suporta texto + imagem como input :contentReference[oaicite:1]{index=1}
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content,
        },
      ],
      temperature: 0.7,
    });

    // A SDK retorna texto agregado em output_text (quando disponível).
    const text = (response as any).output_text?.trim?.() ?? "";

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        score: 50,
        strengths: [],
        weaknesses: ["A IA não retornou JSON válido nesta tentativa."],
        improvements: ["Tente novamente com uma descrição mais detalhada e frames mais nítidos."],
        title: "Sugestão de título",
        caption: "Sugestão de legenda",
        cta: "Sugestão de CTA",
        frame_insights: [],
        raw: text,
      };
    }

    return res.status(200).json(parsed);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}
