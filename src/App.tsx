import Analyze from "./pages/Analyze";

export default function App() {
  // MODO SEGURO: se abrir com ?safe=1 o app NÃO usa nada avançado
  const safe = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("safe") === "1";

  if (safe) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0d12", color: "white", padding: 16, fontFamily: "system-ui" }}>
        <h1 style={{ marginTop: 0 }}>✅ Modo Seguro</h1>
        <p style={{ opacity: 0.8 }}>
          Se isso aparece, React está renderizando. Então o problema está dentro da tela Analyze (ou algum import).
        </p>
        <p style={{ opacity: 0.8 }}>
          Agora abra sem <b>?safe=1</b> para ver o erro na tela.
        </p>
      </div>
    );
  }

  return <Analyze />;
}
