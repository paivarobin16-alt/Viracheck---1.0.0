import { useState } from "react";

export default function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateFingerprint(file: File) {
    const text = `${file.name}-${file.size}-${file.lastModified}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function analyze() {
    if (!file) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const fingerprint = await generateFingerprint(file);

      const res = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fingerprint,
          duration: Math.round(file.size / 100000),
          platform: "Todas",
          hook: "",
          description: "",
        }),
      });

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Servidor não retornou JSON");
      }

      if (!res.ok) {
        throw new Error(data.error || "Erro ao analisar");
      }

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
        maxWidth: 420,
        margin: "0 auto",
        padding: 16,
        background: "#0f172a",
        borderRadius: 16,
        color: "#fff",
      }}
    >
      <h2 style={{ textAlign: "center" }}>🚀 ViraCheck AI</h2>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{ marginBottom: 12 }}
      />

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
          <ul>
            {result.pontos_fortes?.map((p: string, i: number) => (
              <li key={i}>{p}</li>
            ))}
          </ul>

          <h4>Pontos fracos</h4>
          <ul>
            {result.pontos_fracos?.map((p: string, i: number) => (
              <li key={i}>{p}</li>
            ))}
          </ul>

          <h4>O que melhorar</h4>
          <ol>
            {result.melhorias?.map((m: string, i: number) => (
              <li key={i}>{m}</li>
            ))}
          </ol>

          <h4>🎵 Músicas recomendadas</h4>
          <ul>
            {result.musicas?.map((m: string, i: number) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
