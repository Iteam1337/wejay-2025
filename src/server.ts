import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import serve from 'koa-static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = new Koa();

app.use(cors());
app.use(bodyParser());

// Serve static files from dist
app.use(serve(join(__dirname, '../dist')));

// Default route
app.use(async (ctx) => {
  ctx.body = 'Wejay API Server';
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Koa server running on port ${port}`);
});