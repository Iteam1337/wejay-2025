import 'dotenv/config';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import serve from 'koa-static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { authMiddleware } from './middleware/auth.js';
import { roomsApiMiddleware } from './middleware/rooms.js';
import { queueApiMiddleware } from './middleware/queue.js';

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
app.listen(port, () => {
  console.log(`🚀 Koa server running on port ${port}`);
});