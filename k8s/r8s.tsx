import { Platform, App } from '@r8s/recipes'

// Read version from package.json for image tag
const packageJson = { version: '1.0.0' } // Fallback, will be overridden by env
try {
  const pkg = await import('../package.json', { assert: { type: 'json' } })
  packageJson.version = pkg.default.version
} catch {
  // Use fallback if package.json can't be loaded
}

const version = process.env.IMAGE_TAG || packageJson.version || 'latest'
const image = `ghcr.io/iteam1337/wejay-2025:${version}`

export default (
  <Platform
    namespace="wejay"
    routing="ingress"
    secrets={{ backend: 'openbao', mount: 'secret', path: 'wejay' }}
  >
    <App
      name="wejay"
      image={image}
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
