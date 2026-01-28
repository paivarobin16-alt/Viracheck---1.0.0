import { useMemo, useState } from "react";

type ApiResponse = {
  result?: any;
  error?: string;
  details?: string;
  status?: number;
};

async function extractFrames(
  file: File,
  frameCount = 2,
  targetW = 320,
  quality = 0.5
): Promise<string[]> {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Falha ao carregar o vídeo."));
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado.");

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;

  const scale = targetW / vw;
  canvas.width = targetW;
  canvas.height = Math.max(1, Math.round(vh * scale));

  const duration = video.duration && isFinite(video.duration) ? video.duration : 1;

  const frames: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = Math.min(duration - 0.05, (duration / (frameCount + 1)) * (i + 1));
    video.currentTime = t;

    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", quality));
  }

  URL.revokeObjectURL(video.src);
  return frames;
}

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : ""), [videoFile]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  async function handleAnalyze() {
    setMessage("");
    setResult(null);

    if (!videoFile) {
      setMessage("⚠️ Selecione um vídeo antes de analisar.");
      return;
    }

    setLoading(true);
    try {
      setMessage("⏳ Extraindo frames do vídeo (leve)...");
      const frames = await extractFrames(videoFile, 2, 320, 0.5);

      setMessage("🤖 Enviando para a IA...");
      const resp = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          hook,
          description,
          frames,
        }),
      });

      const raw = await resp.text();

      if (!resp.ok) {
        // Mostra o erro real (inclui details da OpenAI se o backend devolver)
        throw new Error(`API ${resp.status}: ${raw.slice(0, 1200)}`);
      }

      const data = JSON.parse(raw) as ApiResponse;
      if (!data.result) {
        throw new Error(`Resposta inválida da API: ${raw.slice(0, 800)}`);
      }

      setResult(data.result);
      setMessage("✅ Análise concluída!");
    } catch (e: any) {
      setMessage(`❌ ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18 }}>📹 Analisar vídeo</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75, fontSize: 13 }}>
            Envie um vídeo e receba sugestões para melhorar e viralizar.
          </p>
        </div>

        <span
          style={{
            fontSize: 12,
            padding: "8px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            opacity: 0.9,
            whiteSpace: "nowrap",
          }}
        >
          🇧🇷 PT-BR
        </span>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 12, opacity: 0.75 }}>Plataforma</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          style={{
            width: "100%",
            marginTop: 6,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(10,14,24,0.92)",
            color: "white",
          }}
        >
          <option value="Todas">Todas</option>
          <option value="TikTok">TikTok</option>
          <option value="Instagram Reels">Instagram Reels</option>
          <option value="YouTube Shorts">YouTube Shorts</option>
          <option value="Kwai">Kwai</option>
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12, opacity: 0.75 }}>Gancho (opcional)</label>
        <input
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          placeholder='Ex: "Você tá fazendo isso errado..."'
          style={{
            width: "100%",
            marginTop: 6,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(10,14,24,0.92)",
            color: "white",
          }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12, opacity: 0.75 }}>Descrição do vídeo (opcional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva o que acontece no vídeo…"
          style={{
            width: "100%",
            marginTop: 6,
            padding: 12,
            minHeight: 90,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(10,14,24,0.92)",
            color: "white",
            resize: "vertical",
          }}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 12, opacity: 0.75 }}>Upload do vídeo</label>

        <input
          type="file"
          accept="video/*"
          onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          style={{
            width: "100%",
            marginTop: 6,
            padding: 12,
            borderRadius: 12,
            border: "1px dashed rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.04)",
            color: "white",
          }}
        />

        {videoFile && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
              Preview: <b style={{ opacity: 0.95 }}>{videoFile.name}</b>
            </div>
            <video
              src={videoUrl}
              controls
              playsInline
              style={{
                width: "100%",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#000",
              }}
            />
          </div>
        )}
      </div>

      <button className="button" onClick={handleAnalyze} disabled={loading} style={{ marginTop: 14 }}>
        {loading ? "Analisando..." : "Analisar com IA"}
      </button>

      {message && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {message}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>📊 Resultado (JSON)</div>
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                opacity: 0.95,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
