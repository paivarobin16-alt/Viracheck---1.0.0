import React, { useMemo, useState } from "react";

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function extractFrames(file: File, widthMax = 640, maxFrames = 12) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Falha ao carregar o vídeo"));
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  const ratio = video.videoWidth / video.videoHeight || 1;
  const w = Math.min(widthMax, video.videoWidth || widthMax);
  const h = Math.round(w / ratio);

  canvas.width = w;
  canvas.height = h;

  const duration = video.duration || 1;
  const frames: string[] = [];

  for (let i = 0; i < maxFrames; i++) {
    const t = (duration * i) / maxFrames;

    await new Promise<void>((resolve) => {
      video.currentTime = t;
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
    });

    ctx.drawImage(video, 0, 0, w, h);
    frames.push(canvas.toDataURL("image/jpeg", 0.72));
  }

  URL.revokeObjectURL(url);
  return frames;
}

export default function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [cached, setCached] = useState(false);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  async function analyze() {
    try {
      setLoading(true);
      setError("");
      setResult(null);
      setCached(false);

      if (!file) throw new Error("Selecione um vídeo.");

      setStatus("Gerando fingerprint...");
      const hash = await sha256Hex(await file.arrayBuffer());

      setStatus("Extraindo frames...");
      const frames = await extractFrames(file, 640, 12);

      setStatus("Enviando para IA...");
      const resp = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_hash: hash, frames }),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        const msg =
          data?.details?.toString?.() ||
          data?.error?.toString?.() ||
          `Erro HTTP ${resp.status}`;
        throw new Error(msg);
      }

      setResult(data.result);
      setCached(Boolean(data.cached));
      setStatus(data.cached ? "✅ Cache: mesmo vídeo, mesmo resultado." : "✅ Análise concluída!");
    } catch (e: any) {
      setStatus("");
      setError(e?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0d12", color: "#fff", padding: 18 }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>ViraCheck AI</h1>
        <p style={{ opacity: 0.85, marginTop: 8 }}>
          Upload do vídeo → frames → IA → score + sugestões (PT-BR)
        </p>

        <div style={{ background: "#121624", borderRadius: 16, padding: 14 }}>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ width: "100%" }}
          />

          {preview && (
            <video
              src={preview}
              controls
              playsInline
              style={{ width: "100%", marginTop: 12, borderRadius: 14, background: "#000" }}
            />
          )}

          <button
            onClick={analyze}
            disabled={!file || loading}
            style={{
              marginTop: 12,
              width: "100%",
              padding: 14,
              borderRadius: 14,
              border: "none",
              fontWeight: 900,
              fontSize: 16,
              cursor: !file || loading ? "not-allowed" : "pointer",
              opacity: !file || loading ? 0.6 : 1,
              background: "linear-gradient(90deg,#34d399,#60a5fa)",
              color: "#061018",
            }}
          >
            {loading ? "Analisando..." : "Analisar"}
          </button>

          {status && <div style={{ marginTop: 10, opacity: 0.85 }}>{status}</div>}
          {error && (
            <pre style={{ marginTop: 10, color: "#ff7070", whiteSpace: "pre-wrap" }}>{error}</pre>
          )}

          {cached && (
            <div style={{ marginTop: 10, color: "#34d399", fontWeight: 800 }}>
              ✅ Esse vídeo já foi analisado antes (cache).
            </div>
          )}
        </div>

        {result && (
          <div style={{ marginTop: 14, background: "#121624", borderRadius: 16, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>✅ Resultado</div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                Score: <span style={{ color: "#34d399" }}>{result.score_viralizacao}</span>
              </div>
            </div>

            <p style={{ marginTop: 10, opacity: 0.9 }}>{result.resumo}</p>

            <details>
              <summary style={{ cursor: "pointer" }}>Ver JSON completo</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
