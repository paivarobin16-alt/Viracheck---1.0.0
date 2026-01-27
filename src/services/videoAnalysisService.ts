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
  const res = await fetch("/api/analyzeVideo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error || `Erro HTTP ${res.status}`);
  }

  return json as VideoAnalysisResult;
}
