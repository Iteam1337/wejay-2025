import { Plugin } from 'vite';
import Redis from 'ioredis';

export function queueApiPlugin(): Plugin {
  let redis: Redis;

  return {
    name: 'queue-api-middleware',
    configureServer(server) {
      // Initialize Redis client
      redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      });

      server.middlewares.use(async (req, res, next) => {
        // Get track history for user in room (with weekday/time context)
        if (req.url?.startsWith('/api/rooms/') && req.url?.includes('/history') && req.method === 'GET') {
          try {
            const urlParts = req.url.split('/');
            const roomId = urlParts[3];
            const userId = urlParts[5]; // /api/rooms/:roomId/history/:userId

            if (!roomId || !userId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing roomId or userId' }));
              return;
            }

            // Get history from Redis sorted set
            const historyKey = `room:${roomId}:user:${userId}:history`;
            const entries = await redis.zrange(historyKey, 0, -1);

            const history = entries.map(entry => JSON.parse(entry));

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(history));
          } catch (error) {
            console.error('[Queue API] Get history error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to get history' }));
          }
          return;
        }

        // Get play counts for user in room
        if (req.url?.startsWith('/api/rooms/') && req.url?.includes('/playcounts') && req.method === 'GET') {
          try {
            const urlParts = req.url.split('/');
            const roomId = urlParts[3];
            const userId = urlParts[5]; // /api/rooms/:roomId/playcounts/:userId

            if (!roomId || !userId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing roomId or userId' }));
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

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(playCounts));
          } catch (error) {
            console.error('[Queue API] Get play counts error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to get play counts' }));
          }
          return;
        }

        // Move track up in queue (for own tracks only)
        if (req.url?.startsWith('/api/rooms/') && req.url?.includes('/queue/move') && req.method === 'POST') {
          try {
            const roomId = req.url.split('/')[3];

            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });

            req.on('end', async () => {
              try {
                const { trackId, userId, direction } = JSON.parse(body);

                if (!trackId || !userId || !direction) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Missing trackId, userId, or direction' }));
                  return;
                }

                // Get current queue from Redis
                const queueData = await redis.get(`room:${roomId}:queue`);
                const queue = queueData ? JSON.parse(queueData) : { tracks: [] };

                // Find the track
                const trackIndex = queue.tracks.findIndex((t: any) => t.id === trackId);
                
                if (trackIndex === -1) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: 'Track not found' }));
                  return;
                }

                const track = queue.tracks[trackIndex];

                // Verify ownership
                if (track.addedBy !== userId) {
                  res.statusCode = 403;
                  res.end(JSON.stringify({ error: 'Can only move your own tracks' }));
                  return;
                }

                // Can't move the currently playing track (index 0)
                if (trackIndex === 0) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Cannot move currently playing track' }));
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
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ tracks: queue.tracks }));
                  return;
                }

                // Move the track
                queue.tracks.splice(trackIndex, 1);
                queue.tracks.splice(newIndex, 0, track);

                // Save to Redis
                await redis.set(`room:${roomId}:queue`, JSON.stringify(queue));

                console.log(`[Queue API] Moved track ${trackId} ${direction} in room ${roomId}`);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ tracks: queue.tracks }));
              } catch (error) {
                console.error('[Queue API] Move track error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to move track' }));
              }
            });

            return;
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to process request' }));
            return;
          }
        }

        next();
      });
    },

    closeBundle() {
      if (redis) {
        redis.disconnect();
      }
    },
  };
}
