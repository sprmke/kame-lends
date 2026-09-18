import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { LOCAL_DEV_PORT } from "./scripts/dev/local-dev-port.mjs";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: { port: LOCAL_DEV_PORT, strictPort: true },
  optimizeDeps: {
    include: ["apexcharts"],
  },
  ssr: {
    // Keep @react-pdf on the serverless Node module path (yoga-layout / pdfkit break when bundled).
    external: [
      "@react-pdf/renderer",
      "@react-pdf/layout",
      "@react-pdf/render",
      "@react-pdf/font",
      "@react-pdf/primitives",
      "yoga-layout",
      "web-push",
    ],
  },
});
