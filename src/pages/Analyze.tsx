import { useState } from "react";

export default function Analyze() {
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

  async function extractFrames(file: File): Promise<string[]> {
    const videoEl = document.createElement("video");
    videoEl.src = URL.createObjectURL(file);
    videoEl.muted = true;
    videoEl.playsInline = true;

    await new Promise((res) => (videoEl.onloadedmetadata = () => res(null)));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = 320;
    canvas.height = (videoEl.videoHeight / videoEl.videoWidth) * 320;

    const times = [0.1, 0.4, 0.7, 0.9];
    const frames: string[] = [];

    for (const p of times) {
      videoEl.currentTime = videoEl.duration * p;
      await new Promise((r) => (videoEl.onseeked = () => r(null)));
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.6));
    }

    return frames;
  }

  async function analyze() {
    if (!video) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const frames = await extractFrames(video);
      const hash = `${video.name}_${video.size}_${video.lastModified}`;

      const resp = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_hash: hash,
          frames,
        }),
      });

      const raw = await resp.text();
      const data = JSON.parse(raw);

      if (!resp.ok) throw new Error(data.error || "Erro");

      setResult(data.result);
    } catch (e: any) {
      setError(e.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>ViraCheck AI</h1>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => setVideo(e.target.files?.[0] || null)}
      />

      <button onClick={analyze} disabled={!video || loading}>
        {loading ? "Analisando..." : "Analisar vídeo"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div>
          <h2>Score: {result.score_viralizacao}</h2>
          <p>{result.resumo}</p>
        </div>
      )}
    </div>
  );
}
