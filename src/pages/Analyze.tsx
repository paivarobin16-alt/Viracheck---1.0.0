import { useState } from "react";

export default function Analyze() {
  const [video, setVideo] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function fingerprint(file: File) {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  async function analyze() {
    if (!video) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_fingerprint: fingerprint(video),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error("Erro na análise");

      setResult(data.result);
    } catch {
      setError("Erro ao analisar o vídeo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-700 via-indigo-700 to-blue-700 p-4">
      <div className="w-full max-w-sm bg-[#0f172a] rounded-2xl p-4 shadow-2xl text-white">
        <h1 className="text-center text-xl font-bold mb-2">🚀 ViraCheck AI</h1>

        <p className="text-sm text-center opacity-80 mb-3">
          Descubra o potencial real de viralização do seu vídeo
        </p>

        <input
          type="file"
          accept="video/*"
          onChange={(e) => setVideo(e.target.files?.[0] || null)}
          className="mb-3 text-sm"
        />

        {video && (
          <video
            src={URL.createObjectURL(video)}
            controls
            className="rounded-lg mb-3"
          />
        )}

        <button
          onClick={analyze}
          disabled={loading}
          className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-500 font-semibold"
        >
          {loading ? "Analisando..." : "Analisar com IA"}
        </button>

        {error && (
          <div className="mt-3 bg-red-600/80 p-2 rounded text-sm">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <div className="text-center text-lg font-bold">
              🔥 Score: {result.score}/100
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <strong>Diagnóstico</strong>
              <p className="text-sm mt-1">{result.diagnostico}</p>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <strong>Pontos fortes</strong>
              <ul className="list-disc list-inside text-sm">
                {result.pontos_fortes.map((p: string, i: number) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <strong>Pontos fracos</strong>
              <ul className="list-disc list-inside text-sm">
                {result.pontos_fracos.map((p: string, i: number) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <strong>O que melhorar</strong>
              <ul className="list-disc list-inside text-sm">
                {result.melhorias_praticas.map((p: string, i: number) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-800 p-3 rounded">
              <strong>🎵 Música recomendada</strong>
              <ul className="list-disc list-inside text-sm">
                {result.musicas_recomendadas.map((p: string, i: number) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
        }
