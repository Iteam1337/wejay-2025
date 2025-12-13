# Wejay

A democratic Spotify jukebox where everyone gets to contribute songs. Track order is determined by the D'Hondt method for fair distribution.

## Features

- **Democratic Queue** - Songs are distributed fairly between users using the D'Hondt algorithm
- **Spotify Integration** - Search and add songs from Spotify's catalog
- **Real-time Updates** - See what others add to the queue instantly
- **Room-based** - Create rooms and invite colleagues or friends
- **Fair Play Algorithm** - Prevents any single user from dominating the playlist

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **UI Components:** Shadcn/ui with custom design system
- **Backend:** Express.js with Socket.IO for real-time features
- **Database:** Redis for session management and caching
- **Authentication:** OAuth 2.0 with Spotify
- **Deployment:** Docker + Kubernetes

## Local Development

```bash
# Clone the repository
git clone https://github.com/Iteam1337/wejay-2025.git
cd wejay-2025

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Add your Spotify credentials to .env

# Start development server
npm run dev
```

## Environment Variables

```env
# Spotify OAuth
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
CLIENT_SECRET=your_spotify_client_secret

# Optional: Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional: Server configuration
PORT=8080
NODE_ENV=development
```

Create an app on the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) to get your credentials.

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run build:dev    # Build in development mode
npm run lint         # Run ESLint
npm run preview      # Preview production build
npm run start        # Start production server
```

## Docker

```bash
# Build the image
docker build -t wejay .

# Run the container
docker run -p 8080:8080 \
  -e VITE_SPOTIFY_CLIENT_ID=xxx \
  -e CLIENT_SECRET=xxx \
  wejay
```

## Kubernetes

See the `/k8s` directory for deployment configurations:
- `deployment.yaml` - Kubernetes deployment
- `service.yaml` - ClusterIP service  
- `ingress.yaml` - Ingress with TLS via cert-manager
- `redis.yaml` - Redis cluster configuration

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│   React App     │────▶│  Spotify Web API │
│   (Vite/TS)     │     │   (OAuth 2.0)    │
└─────────────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Express.js     │────▶│      Redis       │
│  + Socket.IO    │     │  (Sessions/Caching)│
└─────────────────┘     └──────────────────┘
```

## The D'Hondt Method

The algorithm ensures fair play in the queue:

1. Each user gets "votes" based on their number of contributions
2. Songs are ranked by `votes / (already_played + 1)`
3. Result: No user can dominate the queue

This ensures that even users who contribute fewer songs get fair representation in the playlist.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.