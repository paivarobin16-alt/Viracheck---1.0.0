import { useEffect, useRef, useState } from "react";

type AnalysisResult = {
  score: number;
  resumo: string;
  pontos_fortes: string[];
  pontos_fracos: string[];
  melhorias: string[];
  musicas: string[];
  fingerprint: string;
  duracao: string;
  plataforma: string;
};

type HistoryItem = {
  filename: string;
  score: number;
  fingerprint: string;
  createdAt: number;
};

const STORAGE_KEY = "viracheck_history_v1";

export default function Analyze() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  /* =========================
     HISTÓRICO (LOCAL DO USUÁRIO)
     ========================= */
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  function saveHistory(item: HistoryItem) {
    const updated = [
      item,
      ...history.filter(h => h.fingerprint !== item.fingerprint),
    ].slice(0, 5);

    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  /* ========================= */

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  }

  async function analyzeVideo() {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("video", file);

      const res = await fetch("/api/analyzeVideo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao analisar vídeo");
      }

      setResult(data);

      saveHistory({
        filename: file.name,
        score: data.score,
        fingerprint: data.fingerprint,
        createdAt: Date.now(),
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 px-4">
      <div className="w-full max-w-md bg-[#0f172a] rounded-2xl shadow-xl p-5 text-white">

        <h1 className="text-xl font-bold mb-1">🚀 ViraCheck AI</h1>
        <p className="text-sm text-gray-300 mb-4">
          Descubra o potencial real de viralização do seu vídeo
        </p>

        <label className="block text-sm mb-1">Upload do vídeo</label>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="mb-3 w-full text-sm"
        />

        {preview && (
          <video
            ref={videoRef}
            src={preview}
            controls
            className="rounded-xl mb-4 w-full"
          />
        )}

        <button
          onClick={analyzeVideo}
          disabled={loading || !file}
          className="w-full py-2 rounded-xl font-semibold bg-gradient-to-r from-emerald-400 to-blue-500 disabled:opacity-50"
        >
          {loading ? "Analisando..." : "Analisar com IA"}
        </button>

        {error && (
          <div className="mt-3 text-sm text-red-400">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="mt-5 space-y-3 text-sm">
            <div className="text-lg font-bold">
              🔥 Score: {result.score}/100
            </div>

            <div>
              <strong>Resumo</strong>
              <p className="text-gray-300">{result.resumo}</p>
            </div>

            <div>
              <strong>Pontos fortes</strong>
              <ul className="list-disc list-inside text-gray-300">
                {result.pontos_fortes.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            <div>
              <strong>Pontos fracos</strong>
              <ul className="list-disc list-inside text-gray-300">
                {result.pontos_fracos.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            <div>
              <strong>O que melhorar</strong>
              <ul className="list-decimal list-inside text-gray-300">
                {result.melhorias.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>

            <div>
              <strong>🎵 Músicas recomendadas</strong>
              <ul className="list-disc list-inside text-gray-300">
                {result.musicas.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-6">
            <h2 className="font-semibold mb-2">📁 Seu histórico</h2>
            <div className="space-y-2 text-sm">
              {history.map(h => (
                <div
                  key={h.fingerprint}
                  className="flex justify-between bg-slate-800 rounded-lg px-3 py-2"
                >
                  <span className="truncate">{h.filename}</span>
                  <span className="font-bold">{h.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
