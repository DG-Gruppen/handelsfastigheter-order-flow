import { defineConfig, type PluginOption } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const loadReactPlugin = async (): Promise<PluginOption | null> => {
  try {
    const { default: react } = await import("@vitejs/plugin-react-swc");
    return react();
  } catch {
    console.warn("[vite] SWC binding saknas i denna miljö, fallback till standard TSX-transform.");
    return null;
  }
};

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const reactPlugin = await loadReactPlugin();

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      reactPlugin,
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          navigateFallbackDenylist: [/^\/~oauth/],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        },
        manifest: {
          name: "SHF Intra",
          short_name: "SHF",
          description: "Svensk Handelsfastigheters intranät",
          theme_color: "#2e4a63",
          background_color: "#f0f1f4",
          display: "standalone",
          start_url: "/dashboard",
          icons: [
            { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
      }),
    ].filter((plugin): plugin is PluginOption => Boolean(plugin)),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
