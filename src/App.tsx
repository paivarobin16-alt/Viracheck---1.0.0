import Analyze from "./pages/Analyze";
import "./styles/app.css";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">🚀 Viracheck AI</div>
        <div className="subtitle">Análise inteligente de vídeos (mobile-first)</div>
      </header>

      <main className="content">
        <Analyze />
      </main>

      <footer className="footer">© {new Date().getFullYear()} Viracheck AI</footer>
    </div>
  );
}
