import Analyze from "./pages/Analyze";
import Privacy from "./pages/Privacy";
import Footer from "./components/Footer";
import { BrowserRouter, Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Conteúdo principal */}
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Analyze />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </div>

        {/* Rodapé (NÃO interfere no app) */}
        <Footer />
      </div>
    </BrowserRouter>
  );
}
