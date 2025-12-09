import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { join } from 'path';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

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

// Basic API routes (simplified for production)
app.use(express.json());

// Spotify auth proxy
app.post('/api/auth/exchange-token', async (req, res) => {
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.VITE_SPOTIFY_CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: req.body.code,
        redirect_uri: req.body.redirect_uri
      })
    });
    
    const data = await response.json();
    
    // Set httpOnly cookie
    res.setHeader('Set-Cookie', `access_token=${data.access_token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${data.expires_in}`);
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// Basic room management
app.get('/api/rooms/:roomId', async (req, res) => {
  // TODO: Implement room lookup
  res.json({ id: req.params.roomId, name: `Room ${req.params.roomId}` });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  
  socket.on('room:join', ({ roomId, userId }) => {
    socket.join(roomId);
    socket.to(roomId).emit('user:joined', { userId });
  });
  
  socket.on('room:leave', ({ roomId, userId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user:left', { userId });
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
  });
});

// Serve static files
app.use(express.static(join(__dirname, '../dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

const PORT = parseInt(process.env.PORT || '8080');

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Wejay server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 URL: ${process.env.NODE_ENV === 'production' ? 'https://wejay.org' : `http://localhost:${PORT}`}`);
});

export default app;