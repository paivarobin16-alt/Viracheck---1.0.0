export type VideoAnalysisResult = {
  score: number;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  title: string;
  caption: string;
  cta: string;
};

const NETLIFY_BACKEND = "https://viracheck-ai.netlify.app";

export async function analyzeVideo(data: {
  duration: number;
  platform: string;
  hook: string;
  description: string;
}): Promise<VideoAnalysisResult> {
  const res = await fetch(`${NETLIFY_BACKEND}/.netlify/functions/analyzeVideo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || `Erro HTTP ${res.status}`);
  }

  return JSON.parse(text);
}
