import Router from '@koa/router';
import Redis from 'ioredis';
const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
    });
async function getQueue(roomId) {
    const data = await redis.get(`room:${roomId}:queue`);
    return data ? JSON.parse(data) : { tracks: [] };
}
async function saveQueue(roomId, queue) {
    await redis.set(`room:${roomId}:queue`, JSON.stringify(queue));
}
async function getHistory(ctx) {
    const { roomId, userId } = ctx.params;
    const entries = await redis.zrange(`room:${roomId}:user:${userId}:history`, 0, -1);
    ctx.body = entries.map((entry) => JSON.parse(entry));
}
async function getPlayCounts(ctx) {
    const { roomId, userId } = ctx.params;
    const pattern = `room:${roomId}:user:${userId}:track:*`;
    const keys = await redis.keys(pattern);
    const playCounts = {};
    for (const key of keys) {
        const count = await redis.get(key);
        const trackId = key.split(':').slice(5).join(':');
        playCounts[trackId] = parseInt(count || '0', 10);
    }
    ctx.body = playCounts;
}
function validateMoveRequest(body) {
    if (!body.trackId)
        return 'Missing trackId';
    if (!body.userId)
        return 'Missing userId';
    if (!body.direction)
        return 'Missing direction';
    return null;
}
function calculateNewIndex(currentIndex, direction, queueLength) {
    if (direction === 'up') {
        return Math.max(1, currentIndex - 1); // Can't go before currently playing
    }
    return Math.min(queueLength - 1, currentIndex + 1);
}
async function moveTrack(ctx) {
    const { roomId } = ctx.params;
    const body = ctx.request.body;
    const validationError = validateMoveRequest(body);
    if (validationError) {
        ctx.status = 400;
        ctx.body = { error: validationError };
        return;
    }
    const queue = await getQueue(roomId);
    const trackIndex = queue.tracks.findIndex((t) => t.id === body.trackId);
    if (trackIndex === -1) {
        ctx.status = 404;
        ctx.body = { error: 'Track not found' };
        return;
    }
    const track = queue.tracks[trackIndex];
    if (track.addedBy !== body.userId) {
        ctx.status = 403;
        ctx.body = { error: 'Can only move your own tracks' };
        return;
    }
    if (trackIndex === 0) {
        ctx.status = 400;
        ctx.body = { error: 'Cannot move currently playing track' };
        return;
    }
    const newIndex = calculateNewIndex(trackIndex, body.direction, queue.tracks.length);
    if (newIndex === trackIndex) {
        ctx.body = { tracks: queue.tracks };
        return;
    }
    queue.tracks.splice(trackIndex, 1);
    queue.tracks.splice(newIndex, 0, track);
    await saveQueue(roomId, queue);
    console.log(`[Queue API] Moved track ${body.trackId} ${body.direction} in room ${roomId}`);
    ctx.body = { tracks: queue.tracks };
}
export function queueApiMiddleware() {
    const router = new Router({ prefix: '/api/rooms' });
    router.get('/:roomId/history/:userId', getHistory);
    router.get('/:roomId/playcounts/:userId', getPlayCounts);
    router.post('/:roomId/queue/move', moveTrack);
    return router.routes();
}
