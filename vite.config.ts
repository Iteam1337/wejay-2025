import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor libraries
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // UI components library
          ui: [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          // Spotify-related code
          spotify: [
            '@/hooks/useSpotifyAuth',
            '@/hooks/useSpotifyFavorites',
            '@/hooks/useSpotifyPlayer',
            '@/hooks/useSpotifyRecommendations',
            '@/hooks/useSpotifySearch',
            '@/components/SpotifyPlayer',
            '@/components/SpotifyPlaylistSync',
          ],
          // Socket.IO and real-time features
          realtime: [
            'socket.io-client',
            '@/hooks/useSocket',
            '@/components/OnlineUsers',
          ],
          // Chart and visualization libraries
          charts: ['recharts'],
          // Utility libraries
          utils: [
            'clsx',
            'tailwind-merge',
            'date-fns',
            'lucide-react',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase warning limit
  },
  plugins: [
    react(), 
    spotifyAuthPlugin(),
    roomsApiPlugin(),
    queueApiPlugin(),
    socketIoPlugin()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
});
