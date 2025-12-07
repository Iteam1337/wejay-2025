import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/spotify/token': {
        target: 'https://accounts.spotify.com',
        changeOrigin: true,
        rewrite: () => '/api/token',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
            const clientSecret = process.env.VITE_SPOTIFY_CLIENT_SECRET;
            const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            proxyReq.setHeader('Authorization', `Basic ${auth}`);
            proxyReq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
          });
        },
      },
      '/api/spotify': {
        target: 'https://api.spotify.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/spotify/, ''),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
