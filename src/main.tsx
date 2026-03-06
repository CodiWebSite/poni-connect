import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA auto-update: reload page when a new service worker takes control
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
