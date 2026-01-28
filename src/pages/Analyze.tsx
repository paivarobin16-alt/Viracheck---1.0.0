import { useMemo, useState } from "react";

type Analysis = {
  score_viralizacao?: number;
  resumo?: string;
  pontos_fortes?: string[];
  pontos_fracos?: string[];
  melhorias_praticas?: string[];
  ganchos?: string[];
  legendas?: string[];
  hashtags?: string[];
  observacoes?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  return [];
}

function normalizeResult(anyJson: any): Analysis {
  // A API pode retornar:
  // 1) { result: {...} }
  // 2) { ...analysis... }
  // 3) { data: {...} } (variações)
  const r = anyJson?.result ?? anyJson?.data ?? anyJson ?? {};
  return {
    score_viralizacao: Number.isFinite(Number(r.score_viralizacao))
      ? Number(r.score_viralizacao)
      : 0,
    resumo: typeof r.resumo === "string" ? r.resumo : "",
    pontos_fortes: safeArray(r.pontos_fortes),
    pontos_fracos: safeArray(r.pontos_fracos),
    melhorias_praticas: safeArray(r.melhorias_praticas),
    ganchos: safeArray(r.ganchos),
    legendas: safeArray(r.legendas),
    hashtags: safeArray(r.hashtags),
    observacoes: typeof r.observacoes === "string" ? r.observacoes : "",
  };
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
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

/**
 * Extract frames spread across the video.
 * - Mobile friendly: uses fallback timeouts
 * - Uses 4 frames: 5%, 35%, 65%, 90%
 */
async function extractFrames(
  file: File,
  frameCount = 4,
  targetW = 420,
  quality = 0.7
): Promise<string[]> {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Falha ao carregar o vídeo."));
  });

  // Ajuda no Android: garante que dados carreguem
  await new Promise<void>((resolve) => {
    video.onloadeddata = () => resolve();
    setTimeout(resolve, 700);
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado.");

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;

  const scale = targetW / vw;
  canvas.width = targetW;
  canvas.height = Math.max(1, Math.round(vh * scale));

  const duration =
    Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;

  const percents = [0.05, 0.35, 0.65, 0.9].slice(0, frameCount);
  const frames: string[] = [];

  for (const p of percents) {
    const t = Math.min(
      Math.max(duration * p, 0.08),
      Math.max(duration - 0.15, 0.08)
    );

    video.currentTime = t;

    await new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener("seeked", done);
        resolve();
      };
      video.addEventListener("seeked", done);
      setTimeout(() => {
        video.removeEventListener("seeked", done);
        resolve();
      }, 700);
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", quality));
  }

  URL.revokeObjectURL(video.src);
  return frames;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(10,14,24,0.6)",
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {children}
    </span>
  );
}

function Card({
  title,
  icon,
  right,
  children,
}: {
  title: string;
  icon?: string;
  right?: React.ReactNode;
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 16 }}>{icon || "📌"}</div>
          <div style={{ fontWeight: 1000 }}>{title}</div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (!items?.length) {
    return <div style={{ opacity: 0.75, fontSize: 13 }}>Sem itens.</div>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
      {items.map((t, idx) => (
        <li
          key={idx}
          style={{ lineHeight: 1.35, fontSize: 13, opacity: 0.95 }}
        >
          {t}
        </li>
      ))}
    </ul>
  );
}

function CopyList({
  items,
  copyLabel = "Copiar tudo",
}: {
  items: string[];
  copyLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
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
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.35,
                opacity: 0.95,
                whiteSpace: "pre-wrap",
              }}
            >
              {txt}
            </div>
          </div>
        ))
      ) : (
        <div style={{ opacity: 0.75, fontSize: 13 }}>Sem sugestões.</div>
      )}

      {items?.length ? (
        <button
          onClick={async () => {
            const ok = await copyToClipboard(items.join("\n"));
            if (ok) setCopied(true);
            setTimeout(() => setCopied(false), 900);
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.12)",
            background:
              "linear-gradient(90deg, rgba(52,211,153,0.22), rgba(96,165,250,0.22), rgba(167,139,250,0.22))",
            color: "white",
            fontWeight: 1000,
          }}
        >
          {copied ? "✅ Copiado!" : `📋 ${copyLabel}`}
        </button>
      ) : null}
    </div>
  );
}

function HashtagChips({ tags }: { tags: string[] }) {
  const [copied, setCopied] = useState(false);

  if (!tags?.length) return <div style={{ opacity: 0.75 }}>Sem hashtags.</div>;

  const normalized = tags.map((t) => (t.startsWith("#") ? t : `#${t}`));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {normalized.map((t, idx) => (
          <span
            key={idx}
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(10,14,24,0.65)",
              fontSize: 12,
              fontWeight: 900,
              opacity: 0.95,
            }}
          >
            {t}
          </span>
        ))}
      </div>

      <button
        onClick={async () => {
          const ok = await copyToClipboard(normalized.join(" "));
          if (ok) setCopied(true);
          setTimeout(() => setCopied(false), 900);
        }}
        style={{
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.08)",
          color: "white",
          fontWeight: 1000,
        }}
      >
        {copied ? "✅ Hashtags copiadas!" : "📋 Copiar hashtags"}
      </button>
    </div>
  );
}

function LoadingOverlay({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(14,18,30,0.9)",
          padding: 16,
          boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              border: "3px solid rgba(255,255,255,0.25)",
              borderTopColor: "rgba(255,255,255,0.95)",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <div style={{ fontWeight: 1000 }}>Processando…</div>
        </div>
        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>{text}</div>

        <style>
          {`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}
        </style>
      </div>
    </div>
  );
}

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoUrl = useMemo(
    () => (videoFile ? URL.createObjectURL(videoFile) : ""),
    [videoFile]
  );

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Preparando…");
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
      setLoadingText("Extraindo frames do vídeo…");
      const frames = await extractFrames(videoFile, 4, 420, 0.7);

      setLoadingText("Enviando para a IA…");
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

      // Lê como texto pra não crashar caso venha HTML/erro
      const raw = await resp.text();

      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(
          `API retornou algo que não é JSON (${resp.status}). Trecho: ${raw.slice(
            0,
            280
          )}`
        );
      }

      if (!resp.ok) {
        const details =
          parsed?.details ||
          parsed?.error?.message ||
          parsed?.error ||
          raw.slice(0, 800);
        throw new Error(`API ${resp.status}: ${details}`);
      }

      const normalized = normalizeResult(parsed);

      // Evita “tela preta” por dados faltando
      setAnalysis(normalized);
      setMessage("✅ Análise concluída!");
    } catch (e: any) {
      setMessage(`❌ ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const score = clamp(Number(analysis?.score_viralizacao || 0), 0, 100);

  return (
    <div
      style={{
        minHeight: "100vh",
        color: "white",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(96,165,250,0.20), transparent 50%), radial-gradient(900px 600px at 90% 10%, rgba(52,211,153,0.14), transparent 55%), #0b0d12",
        padding: 16,
      }}
    >
      {loading ? <LoadingOverlay text={loadingText} /> : null}

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
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 1000 }}>
              📹 Viracheck AI — Analisar vídeo
            </h1>
            <p style={{ margin: "6px 0 0", opacity: 0.75, fontSize: 13 }}>
              Envie um vídeo e receba sugestões práticas para melhorar e viralizar.
            </p>
          </div>

          <Pill>🇧🇷 PT-BR</Pill>
        </div>

        {/* Form */}
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Plataforma</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(10,14,24,0.92)",
                color: "white",
                fontWeight: 900,
              }}
            >
              <option value="Todas">Todas</option>
              <option value="TikTok">TikTok</option>
              <option value="Instagram Reels">Instagram Reels</option>
              <option value="YouTube Shorts">YouTube Shorts</option>
              <option value="Kwai">Kwai</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Gancho (opcional)</label>
            <input
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder='Ex: "Você tá fazendo isso errado..."'
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(10,14,24,0.92)",
                color: "white",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>
              Descrição do vídeo (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que acontece no vídeo…"
              style={{
                width: "100%",
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

          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Upload do vídeo</label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 14,
                border: "1px dashed rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.04)",
                color: "white",
              }}
            />

            {videoFile && (
              <div style={{ marginTop: 8 }}>
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
              background:
                "linear-gradient(90deg, #34d399 0%, #60a5fa 55%, #a78bfa 100%)",
              color: "#0b1220",
              fontWeight: 1000,
              fontSize: 16,
              boxShadow: "0 18px 50px rgba(96,165,250,0.22)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.85 : 1,
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
          <Card
            title="Resultado"
            icon="📊"
            right={<Pill>Score: {score}/100</Pill>}
          >
            <div style={{ display: "grid", gap: 10 }}>
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
                    width: `${score}%`,
                    height: "100%",
                    borderRadius: 999,
                    background:
                      "linear-gradient(90deg, #34d399 0%, #60a5fa 55%, #a78bfa 100%)",
                  }}
                />
              </div>

              <div
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(10,14,24,0.65)",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 1000, marginBottom: 6 }}>🧠 Resumo</div>
                <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.95 }}>
                  {analysis.resumo || "—"}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Pontos fortes" icon="✅">
            <List items={safeArray(analysis.pontos_fortes)} />
          </Card>

          <Card title="Pontos fracos" icon="⚠️">
            <List items={safeArray(analysis.pontos_fracos)} />
          </Card>

          <Card title="Melhorias práticas" icon="🛠️">
            <List items={safeArray(analysis.melhorias_praticas)} />
          </Card>

          <Card
            title="Ganchos prontos"
            icon="🎯"
            right={
              <button
                onClick={() => copyToClipboard(safeArray(analysis.ganchos).join("\n"))}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.08)",
                  color: "white",
                  fontWeight: 1000,
                  fontSize: 12,
                }}
              >
                📋 Copiar
              </button>
            }
          >
            <CopyList items={safeArray(analysis.ganchos)} />
          </Card>

          <Card
            title="Legendas prontas"
            icon="📝"
            right={
              <button
                onClick={() =>
                  copyToClipboard(safeArray(analysis.legendas).join("\n"))
                }
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.08)",
                  color: "white",
                  fontWeight: 1000,
                  fontSize: 12,
                }}
              >
                📋 Copiar
              </button>
            }
          >
            <CopyList items={safeArray(analysis.legendas)} />
          </Card>

          <Card title="Hashtags" icon="🏷️">
            <HashtagChips tags={safeArray(analysis.hashtags)} />
          </Card>

          <Card title="Observações" icon="💡">
            <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.95 }}>
              {analysis.observacoes || "—"}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
