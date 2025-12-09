# WEJAY

En demokratisk Spotify-jukebox där alla får bidra med låtar. Låtordningen bestäms av D'Hondt-metoden för rättvis fördelning.

## FUNKTIONER

- **Demokratisk kö** - Låtar fördelas rättvist mellan användare med D'Hondt-algoritmen
- **Spotify-integration** - Sök och lägg till låtar från Spotify
- **Realtidsuppdateringar** - Se vad andra lägger till i kön
- **Rumsbaserat** - Skapa rum och bjud in kollegor

## TEKNISK STACK

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **UI:** Shadcn/ui komponenter med neumorfisk design
- **Font:** Futura PT (versaler för labels)
- **Backend:** Kräver Lovable Cloud eller Supabase

## LOKAL UTVECKLING

```bash
# Klona projektet
git clone <repo-url>
cd wejay

# Installera dependencies
npm install

# Skapa .env fil
cp .env.example .env
# Lägg till dina Spotify credentials

# Starta dev server
npm run dev
```

## MILJÖVARIABLER

```env
CLIENT_ID=din_spotify_client_id
CLIENT_SECRET=din_spotify_client_secret
```

Skapa en app på [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) för att få credentials.

## DOCKER

```bash
# Bygg image
docker build -t wejay .

# Kör container
docker run -p 8080:8080 \
  -e CLIENT_ID=xxx \
  -e CLIENT_SECRET=xxx \
  wejay
```

## KUBERNETES

Se `/k8s` mappen för deployment-konfiguration:
- `deployment.yaml` - Kubernetes deployment
- `service.yaml` - ClusterIP service  
- `ingress.yaml` - Ingress med TLS via cert-manager
- `external-dns.yaml` - Automatisk DNS för wejay.org

## ARKITEKTUR

```
┌─────────────────┐     ┌──────────────────┐
│   React App     │────▶│  Spotify Web API │
└─────────────────┘     └──────────────────┘
        │
        ▼
┌─────────────────┐     ┌──────────────────┐
│ Lovable Cloud / │────▶│    PostgreSQL    │
│    Supabase     │     │    (Rooms, Users)│
└─────────────────┘     └──────────────────┘
```

## D'HONDT-METODEN

Algoritmen fördelar spelordningen rättvist:

1. Varje användare får "röster" baserat på antal bidrag
2. Låtar rankas efter `röster / (redan_spelade + 1)`
3. Resultatet: ingen användare dominerar kön

## LICENS

MIT
