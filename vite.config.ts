import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { spotifyAuthPlugin } from "./vite-plugin-spotify-auth";
import { roomsApiPlugin } from "./vite-plugin-rooms-api";
import { queueApiPlugin } from "./vite-plugin-queue-api";
import { socketIoPlugin } from "./vite-plugin-socketio";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Make CLIENT_SECRET available to process.env for server-side code
  process.env.CLIENT_SECRET = env.CLIENT_SECRET;
  process.env.VITE_SPOTIFY_CLIENT_ID = env.VITE_SPOTIFY_CLIENT_ID;

  return {
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
            const clientId = process.env.CLIENT_ID;
            const clientSecret = process.env.CLIENT_SECRET;
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
  plugins: [
    react(), 
    spotifyAuthPlugin(),
    roomsApiPlugin(),
    queueApiPlugin(),
    socketIoPlugin(),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
});
