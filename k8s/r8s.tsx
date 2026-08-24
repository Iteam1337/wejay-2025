import { Platform, App } from '@r8s/recipes'

export default (
  <Platform
    namespace="wejay"
    routing="ingress"
    secrets={{ backend: 'openbao', mount: 'secret', path: 'wejay' }}
  >
    <App
      name="wejay"
      image="ghcr.io/iteam1337/wejay-2025:main"
      host="wejay.org"
      port={8080}
      replicas={2}
      cache={true}
      env={{
        NODE_ENV: 'production',
        VITE_SPOTIFY_REDIRECT_URI: 'https://wejay.org/callback',
      }}
      vault={{
        VITE_SPOTIFY_CLIENT_ID: { key: 'spotify-client-id' },
        CLIENT_SECRET: { key: 'spotify-client-secret' },
        BERGET_API_KEY: { key: 'berget-api-key' },
      }}
      resources={{
        requests: { cpu: '100m', memory: '128Mi' },
        limits: { cpu: '500m', memory: '512Mi' },
      }}
      tls={{
        secretName: 'wejay-prod-tls',
        clusterIssuer: 'letsencrypt-prod',
      }}
      dns={true}
    />
  </Platform>
)
