import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// marcador visível mesmo se React der erro depois
const rootEl = document.getElementById("root");
if (rootEl) rootEl.innerHTML = "main.tsx carregou ✅ (iniciando React...)";

ReactDOM.createRoot(rootEl!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
