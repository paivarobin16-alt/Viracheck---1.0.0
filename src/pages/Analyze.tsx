import { useMemo, useState } from "react";

export default function Analyze() {
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const videoUrl = useMemo(() => {
    if (!video) return "";
    return URL.createObjectURL(video);
  }, [video]);

  async function extractFrames(file: File): Promise<string[]> {
    const videoEl = document.createElement("video");
    videoEl.src = URL.createObjectURL(file);
    videoEl.muted = true;
    videoEl.playsInline = true;

    await new Promise((res) => (videoEl.onloadedmetadata = () => res(null)));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não suportado neste navegador.");

    const w = 320;
    const h = Math.max(180, Math.round((videoEl.videoHeight / videoEl.videoWidth) * w));
    canvas.width = w;
    canvas.height = h;

    // 4 frames espalhados
    const times = [0.12, 0.36, 0.64, 0.88];
    const frames: string[] = [];

    for (const p of times) {
      const t = Math.min(videoEl.duration * p, Math.max(0, videoEl.duration - 0.05));
      videoEl.currentTime = t;
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
      const data = (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      })();

      if (!resp.ok) {
        // mostra o erro REAL no app
        const msg =
          typeof data === "string"
            ? data
            : JSON.stringify(data, null, 2);

        throw new Error(msg);
      }

      setResult(data.result);
    } catch (e: any) {
      setError(e?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0d12", color: "#fff", padding: 18 }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>ViraCheck AI</h1>
        <p style={{ marginTop: 8, opacity: 0.85 }}>
          Envie um vídeo e receba sugestões para melhorar e viralizar.
        </p>

        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "#121624" }}>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideo(e.target.files?.[0] || null)}
            style={{ width: "100%" }}
          />

          {video && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Arquivo: <b>{video.name}</b>
              </div>
              <video
                src={videoUrl}
                controls
                style={{
                  width: "100%",
                  marginTop: 10,
                  borderRadius: 12,
                  background: "#000",
                }}
              />
            </div>
          )}

          <button
            onClick={analyze}
            disabled={!video || loading}
            style={{
              width: "100%",
              marginTop: 14,
              padding: "14px 16px",
              borderRadius: 14,
              border: "none",
              cursor: !video || loading ? "not-allowed" : "pointer",
              fontWeight: 800,
              fontSize: 16,
              background: "linear-gradient(90deg,#34d399,#60a5fa)",
              color: "#0b0d12",
              opacity: !video || loading ? 0.6 : 1,
            }}
          >
            {loading ? "Analisando com IA..." : "Analisar vídeo"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "#1a1220", border: "1px solid #ff4d4d" }}>
            <div style={{ fontWeight: 800, marginBottom: 8, color: "#ff4d4d" }}>❌ Erro</div>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontSize: 12, opacity: 0.95 }}>
              {error}
            </pre>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "#121624" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>✅ Análise concluída</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                Score: <span style={{ color: "#34d399" }}>{result.score_viralizacao}</span>
              </div>
            </div>

            <p style={{ marginTop: 10, opacity: 0.9 }}>{result.resumo}</p>

            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontWeight: 800 }}>Ver JSON completo</summary>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, marginTop: 10 }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
