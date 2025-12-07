# TODO - WEJAY

## KRITISKT (Måste fixas för fungerande app)

### Backend & Autentisering
- [ ] **Aktivera Lovable Cloud** - Krävs för databas och edge functions
- [ ] **Spotify OAuth-inloggning** - Användare måste logga in med Spotify
- [ ] **Edge function för Spotify token** - Flytta Client Credentials från Vite proxy
- [ ] **Spara CLIENT_ID och CLIENT_SECRET som secrets** i Lovable Cloud

### Databas (Supabase/Lovable Cloud)
- [ ] **Skapa `rooms` tabell** - id, name, created_by, created_at, invite_code
- [ ] **Skapa `room_members` tabell** - room_id, user_id, joined_at
- [ ] **Skapa `queue` tabell** - id, room_id, track_id, added_by, added_at, played_at
- [ ] **RLS policies** - Endast medlemmar kan se/ändra sitt rum

### Rum-funktionalitet
- [ ] **Rumsväljare efter inloggning** - Lista användarens rum
- [ ] **Skapa rum med +** - Modal för att skapa nytt rum
- [ ] **Dela rum** - Generera invite-länk/kod
- [ ] **Gå med i rum** - Via invite-länk eller kod

## HÖG PRIORITET

### Spotify-integration
- [ ] **Synka med Spotify Web Playback SDK** - Kontrollera uppspelning direkt
- [ ] **Hämta användarens playlists** - Som favoriter-alternativ
- [ ] **Spara favoriter per användare** - I databasen

### Realtid
- [ ] **Supabase Realtime för kön** - Alla ser uppdateringar direkt
- [ ] **Presence för online-användare** - Visa vem som är i rummet
- [ ] **Broadcast när låt börjar/slutar** - Synka alla klienter

### Spelarkontroll
- [ ] **Spotify Web Playback SDK** - Spela direkt i browsern (Premium krävs)
- [ ] **Alternativ: Spotify Connect** - Styr extern enhet
- [ ] **Fallback: Öppna i Spotify-appen** - Nuvarande lösning

## MEDIUM PRIORITET

### UX-förbättringar
- [ ] **Drag & drop för att ändra ordning** - På egna låtar
- [ ] **Ta bort egen låt** - Innan den spelats
- [ ] **Rösta upp/ner låtar** - Påverkar D'Hondt-vikten
- [ ] **Sökhistorik** - Senaste sökningar

### Design
- [ ] **Dark/Light mode toggle** - Spara preferens
- [ ] **Animerad progress på nuvarande låt** - I kölistan
- [ ] **Konfetti när din låt spelas** - Liten celebration

### Admin-funktioner
- [ ] **Rumsskapare kan skippa låtar** - Moderering
- [ ] **Blockera användare** - Från rummet
- [ ] **Rensa kön** - Starta om

## LÅG PRIORITET

### PWA & Mobil
- [ ] **PWA manifest** - Installerbar app
- [ ] **Push notifications** - "Din låt spelas snart"
- [ ] **Offline-läge** - Visa kön utan anslutning

### Statistik
- [ ] **Lyssningshistorik** - Vad som spelats
- [ ] **Topplista per rum** - Mest spelade låtar
- [ ] **Användarstatistik** - Dina bidrag över tid

### Integrationer
- [ ] **Slack-bot** - Lägg till låtar via Slack
- [ ] **Discord-bot** - Samma för Discord
- [ ] **Webhook** - När låt börjar spela

## TEKNISK SKULD

- [ ] **Tester** - Unit tests för D'Hondt-algoritmen
- [ ] **Error boundaries** - Graceful error handling
- [ ] **Loading states** - Skeleton loaders
- [ ] **Accessibility** - ARIA labels, keyboard navigation
- [ ] **SEO** - Meta tags för delning

## DEPLOYMENT

- [ ] **GitHub Actions** - CI/CD pipeline
- [ ] **Kubernetes secrets** - För Spotify credentials
- [ ] **Cert-manager** - TLS certifikat för wejay.org
- [ ] **External-DNS** - Automatisk DNS-uppdatering
- [ ] **Health checks** - Liveness/readiness probes

---

## NÄSTA STEG

1. Aktivera Lovable Cloud i Integrations
2. Lägg till Spotify secrets
3. Skapa databastabeller för rum
4. Implementera Spotify OAuth
5. Bygga rumsväljare

*Senast uppdaterad: 2025-12-07*
