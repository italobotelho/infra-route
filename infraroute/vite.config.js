import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const googleMapsApiKey =
    env.VITE_GOOGLE_MAPS_API_KEY || env.GOOGLE_MAPS_API_KEY || "";

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_GOOGLE_MAPS_API_KEY": JSON.stringify(googleMapsApiKey),
    },
    server: {
      proxy: {
        "/api": "http://127.0.0.1:8000",
        "/health": "http://127.0.0.1:8000",
      },
    },
  };
});
