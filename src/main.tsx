import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "./native/capacitorInit";
import { initPwa } from "./lib/pwa";

// Initialize native features (no-op on web).
initNative();

// Guarded service-worker registration + auto-update on new deploys.
initPwa();

createRoot(document.getElementById("root")!).render(<App />);
