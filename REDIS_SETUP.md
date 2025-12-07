# Redis Setup for Wejay

Wejay uses Redis to store room queue and playback state, so everyone stays in sync even when reloading the page.

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker run -d --name wejay-redis -p 6379:6379 redis:alpine
```

### Option 2: Local Installation

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows:**
Download from https://redis.io/download

## Configuration

Add to your `.env` file:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

## What's Stored in Redis

- **Queue State**: `room:{roomId}:queue` - All tracks in the room's playlist
- **Playback State**: `room:{roomId}:playback` - Current track, position, play/pause status

## Testing Redis

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# View all keys
redis-cli keys "*"

# View room queue
redis-cli get "room:your-room-id:queue"
```

## Troubleshooting

### Redis not connecting
- Check if Redis is running: `redis-cli ping`
- Verify port: Redis default is 6379
- Check firewall settings

### Connection refused
```bash
# Start Redis
brew services start redis  # macOS
sudo systemctl start redis  # Linux
```

## Production

For production, use a managed Redis service:
- Redis Cloud (https://redis.com)
- AWS ElastiCache
- Azure Cache for Redis
- Google Cloud Memorystore

Update your `.env`:
```bash
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-password  # if required
```