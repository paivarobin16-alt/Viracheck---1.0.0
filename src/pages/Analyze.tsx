import { useMemo, useState } from "react";

type Analysis = {
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

async function extractFrames(
  file: File,
  frameCount = 2,
  targetW = 360,
  quality = 0.6
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

function ScoreBadge({ score }: { score: number }) {
  const s = clamp(score || 0, 0, 100);
  const label = s >= 85 ? "Excelente" : s >= 70 ? "Bom" : s >= 50 ? "Médio" : "Baixo";
  const glow =
    s >= 85 ? "rgba(46,213,115,0.35)" : s >= 70 ? "rgba(0,195,255,0.35)" : s >= 50 ? "rgba(255,193,7,0.35)" : "rgba(255,77,79,0.35)";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        boxShadow: `0 0 24px ${glow}`,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 14 }}>Score</div>
      <div style={{ fontWeight: 900, fontSize: 14 }}>{s}/100</div>
      <div style={{ fontSize: 12, opacity: 0.8 }}>• {label}</div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const v = clamp(value || 0, 0, 100);
  return (
    <div
      style={{
        width: "100%",
        height: 10,
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.10)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${v}%`,
          height: "100%",
          borderRadius: 999,
          background: "linear-gradient(90deg, #34d399 0%, #60a5fa 55%, #a78bfa 100%)",
        }}
      />
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 16 }}>{icon || "📌"}</div>
        <div style={{ fontWeight: 900 }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (!items?.length) return <div style={{ opacity: 0.75, fontSize: 13 }}>Sem itens.</div>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
      {items.map((t, idx) => (
        <li key={idx} style={{ lineHeight: 1.35, fontSize: 13, opacity: 0.95 }}>
          {t}
        </li>
      ))}
    </ul>
  );
}

function CopyGroup({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: string;
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  return (
    <Card title={title} icon={icon}>
      <div style={{ display: "grid", gap: 10 }}>
        {items?.length ? (
          items.map((txt, idx) => (
            <div
              key={idx}
              style={{
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(10,14,24,0.65)",
                padding: 12,
              }}
            >
              <div style={{ fontSize: 13, lineHeight: 1.35, opacity: 0.95, whiteSpace: "pre-wrap" }}>
                {txt}
              </div>

              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={async () => {
                    const ok = await copyToClipboard(txt);
                    setCopiedIndex(ok ? idx : null);
                    setTimeout(() => setCopiedIndex(null), 900);
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.08)",
                    color: "white",
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {copiedIndex === idx ? "✅ Copiado" : "📋 Copiar"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ opacity: 0.75, fontSize: 13 }}>Sem sugestões.</div>
        )}

        {items?.length ? (
          <button
            onClick={async () => {
              const all = items.join("\n");
              const ok = await copyToClipboard(all);
              setCopiedIndex(ok ? -1 : null);
              setTimeout(() => setCopiedIndex(null), 900);
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "linear-gradient(90deg, rgba(52,211,153,0.25), rgba(96,165,250,0.25), rgba(167,139,250,0.25))",
              color: "white",
              fontWeight: 900,
            }}
          >
            {copiedIndex === -1 ? "✅ Tudo copiado!" : "📋 Copiar tudo"}
          </button>
        ) : null}
      </div>
    </Card>
  );
}

function HashtagChips({ tags }: { tags: string[] }) {
  const [copied, setCopied] = useState(false);

  if (!tags?.length) return <div style={{ opacity: 0.75, fontSize: 13 }}>Sem hashtags.</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tags.map((t, idx) => (
          <span
            key={idx}
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(10,14,24,0.65)",
              fontSize: 12,
              fontWeight: 800,
              opacity: 0.95,
            }}
          >
            {t.startsWith("#") ? t : `#${t}`}
          </span>
        ))}
      </div>

      <button
        onClick={async () => {
          const all = tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
          const ok = await copyToClipboard(all);
          if (ok) setCopied(true);
          setTimeout(() => setCopied(false), 900);
        }}
        style={{
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.08)",
          color: "white",
          fontWeight: 900,
        }}
      >
        {copied ? "✅ Hashtags copiadas!" : "📋 Copiar hashtags"}
      </button>
    </div>
  );
}

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : ""), [videoFile]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  async function handleAnalyze() {
    setMessage("");
    setAnalysis(null);

    if (!videoFile) {
      setMessage("⚠️ Selecione um vídeo antes de analisar.");
      return;
    }

    setLoading(true);
    try {
      setMessage("⏳ Extraindo frames do vídeo (leve)...");
      // 🔥 balanceado pra não estourar payload nem dar 500
      const frames = await extractFrames(videoFile, 2, 360, 0.6);

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
      if (!resp.ok) throw new Error(`API ${resp.status}: ${raw.slice(0, 1200)}`);

      const data = JSON.parse(raw);
      const result = data?.result;

      if (!result || typeof result !== "object") {
        throw new Error(`Resposta inválida da API: ${raw.slice(0, 800)}`);
      }

      setAnalysis(result as Analysis);
      setMessage("✅ Análise concluída!");
    } catch (e: any) {
      setMessage(`❌ ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          padding: 16,
          boxShadow: "0 18px 70px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 1000 }}>📹 Analisar vídeo</h1>
            <p style={{ margin: "6px 0 0", opacity: 0.75, fontSize: 13 }}>
              Envie um vídeo e receba sugestões práticas para melhorar e viralizar.
            </p>
          </div>

          <span
            style={{
              fontSize: 12,
              padding: "8px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(10,14,24,0.65)",
              whiteSpace: "nowrap",
              fontWeight: 900,
            }}
          >
            🇧🇷 PT-BR
          </span>
        </div>

        {/* Form */}
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Plataforma</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(10,14,24,0.92)",
                color: "white",
                fontWeight: 800,
              }}
            >
              <option value="Todas">Todas</option>
              <option value="TikTok">TikTok</option>
              <option value="Instagram Reels">Instagram Reels</option>
              <option value="YouTube Shorts">YouTube Shorts</option>
              <option value="Kwai">Kwai</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Gancho (opcional)</label>
            <input
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder='Ex: "Você tá fazendo isso errado..."'
              style={{
                width: "100%",
                marginTop: 6,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(10,14,24,0.92)",
                color: "white",
              }}
            />
          </div>

          <div>
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
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(10,14,24,0.92)",
                color: "white",
                resize: "vertical",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Upload do vídeo</label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 12,
                borderRadius: 14,
                border: "1px dashed rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.04)",
                color: "white",
              }}
            />

            {videoFile && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
                  Preview: <b style={{ opacity: 0.95 }}>{videoFile.name}</b>
                </div>
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  style={{
                    width: "100%",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "#000",
                  }}
                />
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 14px",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "linear-gradient(90deg, #34d399 0%, #60a5fa 55%, #a78bfa 100%)",
              color: "#0b1220",
              fontWeight: 1000,
              fontSize: 16,
              boxShadow: "0 18px 50px rgba(96,165,250,0.22)",
            }}
          >
            {loading ? "Analisando..." : "Analisar com IA"}
          </button>

          {message && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {message}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {analysis && (
        <div style={{ maxWidth: 900, margin: "14px auto 0", display: "grid", gap: 12 }}>
          {/* Score */}
          <div
            style={{
              borderRadius: 22,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              padding: 14,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <ScoreBadge score={analysis.score_viralizacao} />
              <div style={{ fontSize: 12, opacity: 0.75, textAlign: "right" }}>
                Dica: use esse score pra testar variações do vídeo.
              </div>
            </div>

            <ProgressBar value={analysis.score_viralizacao} />

            <div
              style={{
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(10,14,24,0.65)",
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 6 }}>🧠 Resumo</div>
              <div style={{ fontSize: 13, lineHeight: 1.4, opacity: 0.95 }}>{analysis.resumo}</div>
            </div>
          </div>

          {/* Strengths / Weakness */}
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr" }}>
            <Card title="Pontos fortes" icon="✅">
              <List items={analysis.pontos_fortes} />
            </Card>

            <Card title="Pontos fracos" icon="⚠️">
              <List items={analysis.pontos_fracos} />
            </Card>

            <Card title="Melhorias práticas" icon="🛠️">
              <List items={analysis.melhorias_praticas} />
            </Card>
          </div>

          {/* Hooks / Captions */}
          <CopyGroup title="Ganchos prontos" icon="🎯" items={analysis.ganchos || []} />
          <CopyGroup title="Legendas prontas" icon="📝" items={analysis.legendas || []} />

          {/* Hashtags */}
          <Card title="Hashtags" icon="🏷️">
            <HashtagChips tags={analysis.hashtags || []} />
          </Card>

          {/* Notes */}
          <Card title="Observações" icon="💡">
            <div style={{ fontSize: 13, lineHeight: 1.4, opacity: 0.95, whiteSpace: "pre-wrap" }}>
              {analysis.observacoes || "—"}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
