export async function analyzeVideo(data: {
  duration: number;
  platform: string;
  hook: string;
  description: string;
}) {
  const res = await fetch("/api/analyzeVideo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Erro HTTP ${res.status}`);

  return json;
}
