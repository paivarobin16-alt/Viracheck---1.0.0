import { useEffect, useState } from "react";

type Result = {
  score: number;
  resumo: string;
  pontos_fortes: string[];
  pontos_fracos: string[];
  melhorias: string[];
  musicas: string[];
};

export default function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 🎥 Preview do vídeo
  useEffect(() => {
    if (!file) {
      setVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 🔐 Fingerprint forte e estável
  async function fingerprintFile(file: File) {
    const base = `${file.name}-${file.size}-${file.lastModified}`;
    const buffer = new TextEncoder().encode(base);
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function analyze() {
    if (!file) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const fingerprint = await fingerprintFile(file);
      const cacheKey = `viracheck:${fingerprint}`;

      // ✅ CACHE LOCAL (MESMO VÍDEO = MESMO RESULTADO)
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setResult(JSON.parse(cached));
        setLoading(false);
        return;
      }

      // 🔁 Chamada normal à API
      const res = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint,
          duration: Math.round(file.size / 100000),
          platform: "Todas",
          hook: "",
          description: "",
        }),
      });

      const text = await res.text();
      const data = JSON.parse(text);

      if (!res.ok) {
        throw new Error(data.error || "Erro ao analisar vídeo");
      }

      // 💾 salva cache
      localStorage.setItem(cacheKey, JSON.stringify(data));
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#6d28d9,#3b82f6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: 360,
          background: "#0f172a",
          borderRadius: 18,
          padding: 16,
          color: "#fff",
          boxShadow: "0 20px 50px rgba(0,0,0,.4)",
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: 12 }}>
          🚀 ViraCheck AI
        </h2>

        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ marginBottom: 12 }}
        />

        {videoUrl && (
          <video
            src={videoUrl}
            controls
            style={{
              width: "100%",
              borderRadius: 12,
              marginBottom: 12,
              background: "#000",
            }}
          />
        )}

        <button
          onClick={analyze}
          disabled={!file || loading}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            background: "linear-gradient(90deg,#22c55e,#3b82f6)",
            color: "#000",
            fontWeight: "bold",
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Analisando..." : "Analisar com IA"}
        </button>

        {error && (
          <div style={{ marginTop: 12, color: "#f87171" }}>❌ {error}</div>
        )}

        {result && (
          <div style={{ marginTop: 16 }}>
            <h3>🔥 Score: {result.score}/100</h3>
            <p>{result.resumo}</p>

            <h4>Pontos fortes</h4>
            <ul>{result.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}</ul>

            <h4>Pontos fracos</h4>
            <ul>{result.pontos_fracos.map((p, i) => <li key={i}>{p}</li>)}</ul>

            <h4>O que melhorar</h4>
            <ol>{result.melhorias.map((m, i) => <li key={i}>{m}</li>)}</ol>

            <h4>🎵 Músicas recomendadas</h4>
            <ul>{result.musicas.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
