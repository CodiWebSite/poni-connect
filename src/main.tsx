import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "./native/capacitorInit";

// Initialize native features (no-op on web).
initNative();

createRoot(document.getElementById("root")!).render(<App />);
