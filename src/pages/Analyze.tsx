import { useEffect, useRef, useState } from "react";

type Result = {
  score: number;
  resumo: string;
  pontos_fortes: string[];
  pontos_fracos: string[];
  melhorias: string[];
  musicas: string[];
  fingerprint: string;
};

type HistoryItem = {
  name: string;
  score: number;
  fingerprint: string;
};

const STORAGE_KEY = "viracheck_history";

export default function Analyze() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  /* ========= HISTÓRICO LOCAL (PRIVADO) ========= */
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  function saveHistory(item: HistoryItem) {
    const updated = [
      item,
      ...history.filter(h => h.fingerprint !== item.fingerprint),
    ].slice(0, 5);

    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  /* ============================================= */

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("video", file);

      const res = await fetch("/api/analyzeVideo", {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na IA");

      setResult(data);

      saveHistory({
        name: file.name,
        score: data.score,
        fingerprint: data.fingerprint,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* ================== UI ================== */
  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <h1 style={styles.title}>🚀 ViraCheck AI</h1>
        <p style={styles.subtitle}>
          Descubra o potencial real de viralização do seu vídeo
        </p>

        <input type="file" accept="video/*" onChange={handleFile} />

        {preview && (
          <video
            ref={videoRef}
            src={preview}
            controls
            style={styles.video}
          />
        )}

        <button
          onClick={analyze}
          disabled={!file || loading}
          style={{
            ...styles.button,
            opacity: !file || loading ? 0.6 : 1,
          }}
        >
          {loading ? "Analisando..." : "Analisar com IA"}
        </button>

        {error && <p style={styles.error}>❌ {error}</p>}

        {result && (
          <div style={styles.section}>
            <h2>🔥 Score: {result.score}/100</h2>

            <p><strong>Resumo:</strong> {result.resumo}</p>

            <strong>Pontos fortes</strong>
            <ul>
              {result.pontos_fortes.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>

            <strong>Pontos fracos</strong>
            <ul>
              {result.pontos_fracos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>

            <strong>O que melhorar</strong>
            <ol>
              {result.melhorias.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ol>

            <strong>🎵 Músicas recomendadas</strong>
            <ul>
              {result.musicas.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {history.length > 0 && (
          <div style={styles.section}>
            <h3>📁 Seu histórico</h3>
            {history.map(h => (
              <div key={h.fingerprint} style={styles.historyItem}>
                <span>{h.name}</span>
                <strong>{h.score}</strong>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

/* ================== STYLES ================== */
const styles: any = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #7c3aed, #2563eb)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    background: "#0f172a",
    color: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
  },
  title: { margin: 0 },
  subtitle: { color: "#cbd5f5", fontSize: 14, marginBottom: 12 },
  video: {
    width: "100%",
    borderRadius: 12,
    marginTop: 12,
  },
  button: {
    marginTop: 12,
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "none",
    fontWeight: "bold",
    color: "#fff",
    background: "linear-gradient(90deg,#22c55e,#3b82f6)",
    cursor: "pointer",
  },
  error: { color: "#f87171", marginTop: 8 },
  section: { marginTop: 16, fontSize: 14 },
  historyItem: {
    display: "flex",
    justifyContent: "space-between",
    background: "#1e293b",
    padding: "6px 10px",
    borderRadius: 8,
    marginTop: 6,
  },
};
