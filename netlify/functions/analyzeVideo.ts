export type VideoAnalysisResult = {
  score: number;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  title: string;
  caption: string;
  cta: string;
};

// ⚠️ COLE AQUI A URL REAL DO SEU SITE NETLIFY
const NETLIFY_BACKEND =
  "https://viracheck-ai.netlify.app";

export async function analyzeVideo(data: {
  duration: number;
  platform: string;
  hook: string;
  description: string;
}): Promise<VideoAnalysisResult> {
  const response = await fetch(
    `${NETLIFY_BACKEND}/.netlify/functions/analyzeVideo`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || "Erro ao chamar a API");
  }

  const text = await response.text();
  return JSON.parse(text);
}
