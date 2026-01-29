import { useState } from "react";
import CryptoJS from "crypto-js";

export default function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function generateFingerprint(file: File) {
    return CryptoJS.SHA256(
      file.name + file.size + file.lastModified
    ).toString();
  }

  async function analyze() {
    if (!file) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const fingerprint = generateFingerprint(file);

      const res = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint,
          duration: Math.round(file.size / 100000), // estimativa leve
          platform: "Todas",
          hook: "",
          description: "",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro desconhecido");
      }

      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button onClick={analyze} disabled={loading || !file}>
        {loading ? "Analisando..." : "Analisar com IA"}
      </button>

      {error && <div className="error">❌ {error}</div>}

      {result && (
        <div className="result">
          <h3>🔥 Score: {result.score}/100</h3>

          <p>{result.resumo}</p>

          <h4>Pontos fortes</h4>
          <ul>
            {result.pontos_fortes.map((p: string, i: number) => (
              <li key={i}>{p}</li>
            ))}
          </ul>

          <h4>Pontos fracos</h4>
          <ul>
            {result.pontos_fracos.map((p: string, i: number) => (
              <li key={i}>{p}</li>
            ))}
          </ul>

          <h4>O que melhorar</h4>
          <ol>
            {result.melhorias.map((m: string, i: number) => (
              <li key={i}>{m}</li>
            ))}
          </ol>

          <h4>Músicas recomendadas</h4>
          <ul>
            {result.musicas.map((m: string, i: number) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
