import { useState } from "react";

type Result = {
  score_viralizacao: number;
  resumo: string;
  pontos_fortes: string[];
  pontos_fracos: string[];
  melhorias_praticas: string[];
  ganchos: string[];
  legendas: string[];
  hashtags: string[];
  observacoes: string;
};

async function extractFrames(
  file: File,
  frameCount = 4,
  targetW = 420,
  quality = 0.7
): Promise<string[]> {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Falha ao carregar o vídeo."));
  });

  await new Promise<void>((resolve) => {
    video.onloadeddata = () => resolve();
    setTimeout(resolve, 600);
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const scale = targetW / vw;

  canvas.width = targetW;
  canvas.height = Math.round(vh * scale);

  const duration =
    Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : 1;

  const percents = [0.05, 0.35, 0.65, 0.9].slice(0, frameCount);
  const frames: string[] = [];

  for (const p of percents) {
    const t = Math.min(
      Math.max(duration * p, 0.05),
      Math.max(duration - 0.1, 0.05)
    );
    video.currentTime = t;

    await new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener("seeked", done);
        resolve();
      };
      video.addEventListener("seeked", done);
      setTimeout(done, 600);
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", quality));
  }

  URL.revokeObjectURL(video.src);
  return frames;
}

export default function Analyze() {
  const [video, setVideo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!video) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const frames = await extractFrames(video, 4, 420, 0.7);

      const resp = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data?.error || "Erro na API");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white px-4 py-6">
      <div className="max-w-md mx-auto space-y-5">
        <h1 className="text-xl font-semibold">📹 Analisar vídeo</h1>
        <p className="text-sm text-gray-400">
          Envie um vídeo e receba sugestões para viralizar.
        </p>

        <input
          type="file"
          accept="video/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setVideo(f);
            setPreview(URL.createObjectURL(f));
          }}
          className="block w-full text-sm"
        />

        {preview && (
          <video
            src={preview}
            controls
            className="w-full rounded-lg border border-gray-700"
          />
        )}

        <button
          onClick={handleAnalyze}
          disabled={!video || loading}
          className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-emerald-400 to-blue-500 text-black disabled:opacity-50"
        >
          {loading ? "Analisando..." : "Analisar com IA"}
        </button>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500 p-3 rounded">
              ✅ Análise concluída
            </div>

            <div className="bg-[#141824] p-4 rounded-xl">
              <p className="text-lg font-bold">
                🔥 Score: {result.score_viralizacao}/100
              </p>
              <p className="text-sm text-gray-300 mt-2">{result.resumo}</p>
            </div>

            <Section title="✅ Pontos fortes" items={result.pontos_fortes} />
            <Section title="⚠️ Pontos fracos" items={result.pontos_fracos} />
            <Section title="🚀 Melhorias práticas" items={result.melhorias_praticas} />
            <Section title="🎯 Ganchos" items={result.ganchos} copy />
            <Section title="📝 Legendas" items={result.legendas} copy />
            <Section title="🏷️ Hashtags" items={result.hashtags} inline copy />

            <div className="bg-[#141824] p-4 rounded-xl text-sm text-gray-300">
              💡 {result.observacoes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  copy,
  inline,
}: {
  title: string;
  items: string[];
  copy?: boolean;
  inline?: boolean;
}) {
  function copyAll() {
    navigator.clipboard.writeText(items.join(inline ? " " : "\n"));
  }

  return (
    <div className="bg-[#141824] p-4 rounded-xl space-y-2">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">{title}</h2>
        {copy && (
          <button
            onClick={copyAll}
            className="text-xs text-emerald-400 hover:underline"
          >
            Copiar
          </button>
        )}
      </div>

      <div className={inline ? "flex flex-wrap gap-2" : "space-y-1"}>
        {items.map((i, idx) => (
          <span
            key={idx}
            className={
              inline
                ? "px-2 py-1 bg-black/40 rounded text-sm"
                : "block text-sm text-gray-300"
            }
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}
