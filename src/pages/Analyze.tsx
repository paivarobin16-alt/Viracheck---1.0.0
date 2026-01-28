import { useMemo, useState } from "react";

type Result = {
  score_viralizacao: number;
  resumo: string;
  pontos_fortes: string[];
  pontos_fracos: string[];
  melhorias_praticas: string[];
  ganchos: string[];
  legendas: string[];
  hashtags: string[];
  observacoes: string;
};

async function extractFrames(videoFile: File, count: number) {
  const url = URL.createObjectURL(videoFile);

  const video = document.createElement("video");
  video.src = url;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Não foi possível carregar o vídeo."));
  });

  const duration = Math.max(0.1, video.duration || 0.1);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado.");

  const targetW = 640;
  const ratio = (video.videoWidth || 1280) / (video.videoHeight || 720);
  canvas.width = targetW;
  canvas.height = Math.round(targetW / ratio);

  const frames: string[] = [];
  const step = duration / (count + 1);

  for (let i = 1; i <= count; i++) {
    const t = Math.min(duration - 0.05, i * step);

    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = t;
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", 0.82));
  }

  URL.revokeObjectURL(url);
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
  const [result, setResult] = useState<Result | null>(null);
  const [fingerprint, setFingerprint] = useState<string>("");

  async function handleAnalyze() {
    setMessage("");
    setResult(null);

    if (!videoFile) {
      setMessage("⚠️ Selecione um vídeo antes de analisar.");
      return;
    }

    setLoading(true);
    try {
      setMessage("⏳ Extraindo frames do vídeo...");
      const frames = await extractFrames(videoFile, 6);

      setMessage("🤖 Enviando para IA (OpenAI)...");
      const resp = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          hook,
          description,
          frames,
          // se você quiser estabilidade máxima, a API já faz cache.
          // fingerprint pode ficar vazio.
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || "Falha ao analisar.");
      }

      setFingerprint(data.fingerprint || "");
      setResult(data.result as Result);
      setMessage(data.cached ? "✅ Resultado (cache) — mesmo vídeo, mesmo resultado." : "✅ Resultado gerado!");
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
          {fingerprint ? `\n\nfingerprint: ${fingerprint}` : ""}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900 }}>Score de viralização</div>
                <div style={{ opacity: 0.8, fontSize: 13 }}>{result.resumo}</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{result.score_viralizacao}/100</div>
            </div>
          </div>

          <Section title="✅ Pontos fortes" items={result.pontos_fortes} />
          <Section title="⚠️ Pontos fracos" items={result.pontos_fracos} />
          <Section title="🛠️ Melhorias práticas" items={result.melhorias_praticas} />

          <Section title="🎣 5 Ganchos" items={result.ganchos} />
          <Section title="📝 5 Legendas" items={result.legendas} />

          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>🏷️ Hashtags</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {result.hashtags.map((h, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 12,
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(10,14,24,0.92)",
                  }}
                >
                  {h.startsWith("#") ? h : `#${h}`}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              opacity: 0.9,
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            <b>Observações:</b> {result.observacoes}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.9 }}>
        {items.map((x, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}
