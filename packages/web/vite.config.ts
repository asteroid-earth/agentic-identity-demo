import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5201,
    proxy: {
      "/api": {
        target: "http://localhost:5200",
        headers: {
          "Teleport-Jwt-Assertion": "proxy injected",
        },
      },
    },
  },
  base: "/web",
});
