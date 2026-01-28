import { useState } from "react";

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // ===============================
  // Extrair frames do vídeo
  // ===============================
  async function extractFrames(file: File, frameCount = 4): Promise<string[]> {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.crossOrigin = "anonymous";
    video.muted = true;

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    const targetWidth = 384;
    const scale = targetWidth / video.videoWidth;
    canvas.width = targetWidth;
    canvas.height = video.videoHeight * scale;

    const frames: string[] = [];
    const duration = video.duration;

    for (let i = 0; i < frameCount; i++) {
      const time = (duration / (frameCount + 1)) * (i + 1);
      video.currentTime = time;

      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.6));
    }

    URL.revokeObjectURL(video.src);
    return frames;
  }

  // ===============================
  // Enviar para API
  // ===============================
  async function handleAnalyze() {
    setError(null);
    setResult(null);

    if (!videoFile) {
      setError("Selecione um vídeo primeiro.");
      return;
    }

    try {
      setLoading(true);

      // 1️⃣ Extrai frames
      const frames = await extractFrames(videoFile, 4);

      // 2️⃣ Chama API (IMPORTANTE: tratamento de erro REAL)
      const resp = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform,
          hook,
          description,
          frames,
        }),
      });

      const raw = await resp.text();

      if (!resp.ok) {
        // 🔥 AQUI aparece o erro real da OpenAI
        throw new Error(`API ${resp.status}: ${raw}`);
      }

      const data = JSON.parse(raw);
      setResult(data.result);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  // ===============================
  // UI
  // ===============================
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
      <h2>📁 Analisar vídeo</h2>
      <p>Envie um vídeo e receba sugestões para melhorar e viralizar.</p>

      <label>Plataforma</label>
      <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
        <option>Todas</option>
        <option>TikTok</option>
        <option>Instagram Reels</option>
        <option>YouTube Shorts</option>
      </select>

      <label>Gancho (opcional)</label>
      <input
        value={hook}
        onChange={(e) => setHook(e.target.value)}
        placeholder='Ex: "Você está fazendo isso errado..."'
      />

      <label>Descrição do vídeo (opcional)</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descreva o que acontece no vídeo..."
      />

      <label>Upload do vídeo</label>
      <input
        type="file"
        accept="video/*"
        onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
      />

      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          marginTop: 16,
          padding: 14,
          width: "100%",
          fontSize: 16,
        }}
      >
        {loading ? "Analisando..." : "Analisar com IA"}
      </button>

      {/* 🔴 ERRO REAL DA API */}
      {error && (
        <div
          style={{
            marginTop: 16,
            background: "#3b0000",
            color: "#ffb3b3",
            padding: 12,
            borderRadius: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* ✅ RESULTADO */}
      {result && (
        <pre
          style={{
            marginTop: 16,
            background: "#0b0b0b",
            color: "#7fffd4",
            padding: 12,
            borderRadius: 8,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
