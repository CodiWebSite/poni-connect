import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "./native/capacitorInit";
import { installSwAutoReload } from "./lib/swAutoReload";

// Initialize native features (no-op on web).
initNative();

// Auto-reload once when a new Service Worker takes control (post-deploy).
installSwAutoReload();


createRoot(document.getElementById("root")!).render(<App />);
