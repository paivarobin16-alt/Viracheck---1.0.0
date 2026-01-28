import { useMemo, useState } from "react";

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : ""), [videoFile]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  async function handleAnalyze() {
    setMessage("");
    if (!videoFile) {
      setMessage("⚠️ Selecione um vídeo antes de analisar.");
      return;
    }

    setLoading(true);
    try {
      // Aqui vai entrar a IA depois (API /api/analyzeVideo)
      // Por enquanto é só uma confirmação que está tudo ok.
      await new Promise((r) => setTimeout(r, 700));

      setMessage("✅ Pronto! Interface ok. Próximo passo: ligar a análise com IA.");
    } catch (e: any) {
      setMessage(`❌ Erro: ${e?.message || String(e)}`);
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
        {loading ? "Analisando..." : "Analisar"}
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
    </div>
  );
}
