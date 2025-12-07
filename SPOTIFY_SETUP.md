# Spotify Authentication Setup

This application uses Spotify's OAuth 2.0 authorization code flow with PKCE for user authentication.

## Prerequisites

1. A Spotify Developer account
2. Spotify Premium (required for full functionality)

## Setup Instructions

### 1. Create Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create an App"
4. Fill in the app details:
   - **App name**: Wejay (or your preferred name)
   - **App description**: Collaborative music sessions with friends
   - **Website**: (optional)
   - **Redirect URI**: `http://localhost:5173/callback` (for development)
   - **What are you building?**: Select appropriate options

### 2. Configure Redirect URIs

In your Spotify app settings, add these redirect URIs:

**Development:**
- `http://localhost:5173/callback`

**Production:**
- `https://yourdomain.com/callback`

### 3. Get Client ID

After creating the app, you'll see your **Client ID**. Copy this value.

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# .env
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
```

Replace `your_spotify_client_id_here` with your actual Client ID from Spotify.

### 5. Required Scopes

The app requests the following Spotify scopes:

- `user-read-private` - Read user's profile information
- `user-read-email` - Read user's email address
- `user-read-playback-state` - Read user's playback state
- `user-modify-playback-state` - Control user's playback
- `streaming` - Stream music using Spotify Web Playback SDK

## Authentication Flow

1. User clicks "Continue with Spotify"
2. User is redirected to Spotify for authorization
3. Spotify redirects back to the callback URL with an authorization code
4. The app exchanges the code for an access token using PKCE
5. User profile is fetched and stored
6. User is redirected to the room selection page

## Security Features

- **PKCE (Proof Key for Code Exchange)**: Prevents authorization code interception attacks
- **State parameter**: Prevents CSRF attacks
- **Token storage**: Access tokens stored in localStorage (consider HttpOnly cookies for production)
- **Token validation**: Tokens are validated on each app load

## Troubleshooting

### "Redirect URI mismatch" error
- Ensure the redirect URI in your Spotify app settings exactly matches the one in your app
- Check for trailing slashes and http/https protocol

### "Invalid client" error
- Verify your Client ID is correctly set in the environment variables
- Make sure there are no extra spaces or characters

### "Spotify Premium Required" message
- The app requires Spotify Premium for full playback functionality
- Free accounts can browse and add tracks but cannot control playback

## Development Notes

- The app uses mock socket.io implementation for development
- In production, replace with actual socket.io server
- The callback page handles the OAuth response automatically
- Authentication state is persisted across page refreshes