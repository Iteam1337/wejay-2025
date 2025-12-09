import Koa from 'koa';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import mount from 'koa-mount';
import serve from 'koa-static';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import Router from '@koa/router';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = new Koa();
const server = createServer(app.callback());

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://wejay.org', 'https://www.wejay.org']
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Redis adapter for Socket.IO (if Redis is available)
if (process.env.REDIS_HOST) {
  try {
    const pubClient = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
    });
    const subClient = pubClient.duplicate();
    
    await Promise.all([pubClient.connect(), subClient.connect()]);
    
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.IO Redis adapter connected');
  } catch (error) {
    console.warn('⚠️ Redis not available, using memory adapter');
  }
}

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://wejay.org', 'https://www.wejay.org']
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(bodyParser());

// API Router
const apiRouter = new Router();

// Spotify auth proxy
apiRouter.post('/auth/exchange-token', async (ctx) => {
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.VITE_SPOTIFY_CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: (ctx.request.body as { code: string }).code,
        redirect_uri: (ctx.request.body as { redirect_uri: string }).redirect_uri
      })
    });
    
    const data = await response.json();
    
    // Set httpOnly cookie
    ctx.cookies.set('access_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: data.expires_in
    });
    
    ctx.body = data;
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: 'Token exchange failed' };
  }
});

// Basic room management
apiRouter.get('/rooms/:roomId', async (ctx) => {
  // TODO: Implement room lookup
  ctx.body = { id: ctx.params.roomId, name: `Room ${ctx.params.roomId}` };
});

app.use(mount('/api', apiRouter.routes()));
app.use(mount('/api', apiRouter.allowedMethods()));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  
  // Join a room - isolated communication
  socket.on('room:join', ({ roomId, userId, userName }) => {
    if (!roomId || !userId) {
      socket.emit('error', { message: 'roomId and userId are required' });
      return;
    }
    
    socket.join(roomId);
    console.log(`👤 User ${userId} (${userName || 'Anonymous'}) joined room ${roomId}`);
    
    // Notify only users in this room
    socket.to(roomId).emit('user:joined', { 
      userId, 
      userName, 
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
    
    // Global notification about room activity (optional)
    io.emit('room:activity', { 
      type: 'user_joined',
      roomId,
      userId,
      userCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
    });
  });
  
  // Leave a room
  socket.on('room:leave', ({ roomId, userId }) => {
    if (!roomId || !userId) return;
    
    socket.leave(roomId);
    console.log(`👤 User ${userId} left room ${roomId}`);
    
    // Notify only users in this room
    socket.to(roomId).emit('user:left', { 
      userId, 
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
    
    // Global notification about room activity
    io.emit('room:activity', { 
      type: 'user_left',
      roomId,
      userId,
      userCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
    });
  });
  
  // Queue management - room specific
  socket.on('queue:add', ({ roomId, track }) => {
    if (!roomId || !track) return;
    
    // Send only to users in this room
    io.to(roomId).emit('queue:updated', { 
      action: 'add',
      track,
      addedBy: socket.id,
      timestamp: new Date().toISOString()
    });
  });
  
  // Track playing - room specific
  socket.on('track:play', ({ roomId, track }) => {
    if (!roomId || !track) return;
    
    // Send only to users in this room
    io.to(roomId).emit('track:playing', { 
      track,
      timestamp: new Date().toISOString()
    });
  });
  
  // Room creation - global notification
  socket.on('room:create', ({ roomId, roomName, createdBy }) => {
    if (!roomId || !roomName) return;
    
    console.log(`🏠 New room created: ${roomName} (${roomId})`);
    
    // Global notification about new room
    io.emit('room:created', { 
      roomId,
      roomName,
      createdBy,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    
    // Find all rooms this socket was in and notify
    const rooms = io.sockets.adapter.rooms;
    for (const [roomId, roomMembers] of rooms.entries()) {
      if (roomMembers.has(socket.id) && !roomId.startsWith(socket.id)) {
        socket.to(roomId).emit('user:disconnected', { 
          socketId: socket.id,
          timestamp: new Date().toISOString()
        });
        
        io.emit('room:activity', { 
          type: 'user_disconnected',
          roomId,
          socketId: socket.id,
          userCount: roomMembers.size - 1
        });
      }
    }
  });
});

// Serve static files
app.use(mount('/', serve(join(__dirname, '../dist'))));

// SPA fallback - must be last
app.use(async (ctx) => {
  if (ctx.path.startsWith('/api')) {
    ctx.status = 404;
    ctx.body = { error: 'API endpoint not found' };
    return;
  }
  
  await serve(join(__dirname, '../dist'))(ctx, async () => {
    // If file not found, serve index.html for SPA
    ctx.type = 'html';
    ctx.body = await readFile(join(__dirname, '../dist/index.html'));
  });
});

const PORT = parseInt(process.env.PORT || '8080');

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Wejay server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 URL: ${process.env.NODE_ENV === 'production' ? 'https://wejay.org' : `http://localhost:${PORT}`}`);
});

export default app;