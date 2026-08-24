import 'dotenv/config';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import serve from 'koa-static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { authMiddleware } from './middleware/auth.js';
import { roomsApiMiddleware } from './middleware/rooms.js';
import { queueApiMiddleware } from './middleware/queue.js';
import { setupSocketIO } from './lib/socket-setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = new Koa();

app.use(cors());
app.use(bodyParser());

// Register API middlewares
app.use(authMiddleware());
app.use(roomsApiMiddleware());
app.use(queueApiMiddleware());

// Serve static files from dist
app.use(serve(join(__dirname, '../dist')));

// SPA fallback - serve index.html for all non-API routes
app.use(async (ctx) => {
  // Skip if it's an API route or a static file with extension
  if (ctx.path.startsWith('/api/') || ctx.path.includes('.')) {
    return;
  }
  
  // For all other routes, serve index.html (SPA routing)
  try {
    const indexPath = join(__dirname, '../dist/index.html');
    const indexContent = readFileSync(indexPath, 'utf8');
    ctx.type = 'text/html';
    ctx.body = indexContent;
  } catch (error) {
    ctx.status = 404;
    ctx.body = 'Application not found';
  }
});

const port = process.env.PORT || 8080;

// Create HTTP server from Koa app
const httpServer = createServer(app.callback());

// Set up Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

// Set up Redis for Socket.IO
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('[Socket.IO] Redis connection failed after 3 retries');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
});

redis.on('connect', () => {
  console.log('[Socket.IO] Connected to Redis');
});

redis.on('error', (err) => {
  console.error('[Socket.IO] Redis error:', err);
});

setupSocketIO(io, redis);

httpServer.listen(port, () => {
  console.log(`🚀 Koa server running on port ${port}`);
  console.log(`🔌 Socket.IO listening on same port`);
});