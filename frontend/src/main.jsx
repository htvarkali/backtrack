import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { getPlayerState } from "./services/player.js";
import "./styles/back-track.css";

// Expose playback state for diagnostics.
window.__player = getPlayerState;
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
