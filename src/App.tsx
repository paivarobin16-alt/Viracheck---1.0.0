import Analyze from "./pages/Analyze";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">🚀 Viracheck AI</div>
        <div className="subtitle">Análise inteligente de vídeos</div>
      </header>

      <main className="content">
        <Analyze />
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Viracheck AI</span>
      </footer>
    </div>
  );
}
