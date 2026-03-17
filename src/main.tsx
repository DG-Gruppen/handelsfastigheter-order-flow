import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Remove splash screen after React mounts
requestAnimationFrame(() => {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    splash.classList.add("fade-out");
    setTimeout(() => splash.remove(), 500);
  }
});
