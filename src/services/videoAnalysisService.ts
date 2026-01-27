export type VideoAnalysisResult = {
  score: number;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  title: string;
  caption: string;
  cta: string;
};

export async function analyzeVideo(data: {
  duration: number;
  platform: string;
  hook: string;
  description: string;
}): Promise<VideoAnalysisResult> {
  const response = await fetch(
    "https://SEU-SITE-NETLIFY.netlify.app/.netlify/functions/analyzeVideo",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || "Erro ao analisar vídeo");
  }

  return response.json();
}

