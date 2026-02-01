import Koa from 'koa';
import Redis from 'ioredis';

let redis: Redis;

export function queueApiMiddleware(): Koa.Middleware {
  // Initialize Redis client
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  });

  return async (ctx, next) => {
    // Get track history for user in room (with weekday/time context)
    if (ctx.path.match(/^\/api\/rooms\/[^/]+\/history\/[^/]+$/) && ctx.method === 'GET') {
      try {
        const urlParts = ctx.path.split('/');
        const roomId = urlParts[3];
        const userId = urlParts[5]; // /api/rooms/:roomId/history/:userId

        if (!roomId || !userId) {
          ctx.status = 400;
          ctx.body = { error: 'Missing roomId or userId' };
          return;
        }

        // Get history from Redis sorted set
        const historyKey = `room:${roomId}:user:${userId}:history`;
        const entries = await redis.zrange(historyKey, 0, -1);

        const history = entries.map(entry => JSON.parse(entry));

        ctx.status = 200;
        ctx.body = history;
      } catch (error) {
        console.error('[Queue API] Get history error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to get history' };
      }
      return;
    }

    // Get play counts for user in room
    if (ctx.path.match(/^\/api\/rooms\/[^/]+\/playcounts\/[^/]+$/) && ctx.method === 'GET') {
      try {
        const urlParts = ctx.path.split('/');
        const roomId = urlParts[3];
        const userId = urlParts[5]; // /api/rooms/:roomId/playcounts/:userId

        if (!roomId || !userId) {
          ctx.status = 400;
          ctx.body = { error: 'Missing roomId or userId' };
          return;
        }

        // Get all keys for this user's play counts in this room
        const pattern = `room:${roomId}:user:${userId}:track:*`;
        const keys = await redis.keys(pattern);

        const playCounts: Record<string, number> = {};
        
        for (const key of keys) {
          const count = await redis.get(key);
          // Extract track ID from key: room:roomId:user:userId:track:trackId
          const trackId = key.split(':').slice(5).join(':');
          playCounts[trackId] = parseInt(count || '0', 10);
        }

        ctx.status = 200;
        ctx.body = playCounts;
      } catch (error) {
        console.error('[Queue API] Get play counts error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to get play counts' };
      }
      return;
    }

    // Move track up in queue (for own tracks only)
    if (ctx.path.match(/^\/api\/rooms\/[^/]+\/queue\/move$/) && ctx.method === 'POST') {
      try {
        const roomId = ctx.path.split('/')[3];
        const { trackId, userId, direction } = ctx.request.body as { 
          trackId: string; 
          userId: string; 
          direction: 'up' | 'down' 
        };

        if (!trackId || !userId || !direction) {
          ctx.status = 400;
          ctx.body = { error: 'Missing trackId, userId, or direction' };
          return;
        }

        // Get current queue from Redis
        const queueData = await redis.get(`room:${roomId}:queue`);
        const queue = queueData ? JSON.parse(queueData) : { tracks: [] };

        // Find the track
        const trackIndex = queue.tracks.findIndex((t: { id: string }) => t.id === trackId);
        
        if (trackIndex === -1) {
          ctx.status = 404;
          ctx.body = { error: 'Track not found' };
          return;
        }

        const track = queue.tracks[trackIndex];

        // Verify ownership
        if (track.addedBy !== userId) {
          ctx.status = 403;
          ctx.body = { error: 'Can only move your own tracks' };
          return;
        }

        // Can't move the currently playing track (index 0)
        if (trackIndex === 0) {
          ctx.status = 400;
          ctx.body = { error: 'Cannot move currently playing track' };
          return;
        }

        // Calculate new position
        let newIndex = trackIndex;
        if (direction === 'up') {
          newIndex = Math.max(1, trackIndex - 1); // Can't go before currently playing
        } else if (direction === 'down') {
          newIndex = Math.min(queue.tracks.length - 1, trackIndex + 1);
        }

        // If position didn't change, just return current queue
        if (newIndex === trackIndex) {
          ctx.status = 200;
          ctx.body = { tracks: queue.tracks };
          return;
        }

        // Move the track
        queue.tracks.splice(trackIndex, 1);
        queue.tracks.splice(newIndex, 0, track);

        // Save to Redis
        await redis.set(`room:${roomId}:queue`, JSON.stringify(queue));

        console.log(`[Queue API] Moved track ${trackId} ${direction} in room ${roomId}`);

        ctx.status = 200;
        ctx.body = { tracks: queue.tracks };
      } catch (error) {
        console.error('[Queue API] Move track error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to move track' };
      }
      return;
    }

    await next();
  };
}