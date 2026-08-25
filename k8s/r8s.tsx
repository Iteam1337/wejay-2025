import { Platform, App } from '@r8s/recipes'

// Read version from package.json for image tag
const packageJson = { version: '1.0.0' }
try {
  const pkg = await import('../package.json', { assert: { type: 'json' } })
  packageJson.version = pkg.default.version
} catch {
  // Use fallback
}

const version = process.env.IMAGE_TAG || packageJson.version || 'latest'
const image = `ghcr.io/iteam1337/wejay-2025:${version}`

// Vault auth for berget-dmz cluster (matches searxng pattern)
function VaultAuth() {
  return (
    <vaultauth
      apiVersion="secrets.hashicorp.com/v1beta1"
      kind="VaultAuth"
      metadata={{ name: 'vault-auth', namespace: 'wejay' }}
      spec={{
        vaultConnectionRef: 'vault-secrets-operator-system/default',
        method: 'kubernetes',
        mount: 'kubernetes-berget-dmz',
        kubernetes: {
          role: 'wejay',
          serviceAccount: 'vault-client',
        },
      }}
    />
  )
}

// Vault service account
function VaultServiceAccount() {
  return (
    <serviceaccount
      apiVersion="v1"
      kind="ServiceAccount"
      metadata={{ name: 'vault-client', namespace: 'wejay' }}
    />
  )
}

// Custom VaultStaticSecret with all required fields for berget-dmz
function WejaySecrets() {
  return (
    <>
      <vaultstaticsecret
        apiVersion="secrets.hashicorp.com/v1beta1"
        kind="VaultStaticSecret"
        metadata={{ name: 'wejay-secret', namespace: 'wejay' }}
        spec={{
          vaultAuthRef: 'vault-auth',
          mount: 'secret',
          type: 'kv-v2',
          path: 'wejay/app',
          refreshAfter: '60s',
          destination: {
            create: true,
            name: 'wejay-secret',
          },
          rolloutRestartTargets: [
            { kind: 'Deployment', name: 'wejay' },
          ],
        }}
      />
    </>
  )
}

export default (
  <Platform namespace="wejay" routing="ingress">
    <VaultServiceAccount />
    <VaultAuth />
    <WejaySecrets />
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
      secrets={{
        VITE_SPOTIFY_CLIENT_ID: { name: 'wejay-secret', key: 'spotify-client-id' },
        CLIENT_SECRET: { name: 'wejay-secret', key: 'spotify-client-secret' },
        BERGET_API_KEY: { name: 'wejay-secret', key: 'berget-api-key' },
      }}
      resources={{
        requests: { cpu: '100m', memory: '128Mi' },
        limits: { cpu: '500m', memory: '512Mi' },
      }}
      tls={{
        secretName: 'wejay-tls',
        clusterIssuer: 'letsencrypt-prod',
      }}
      dns={true}
    />
  </Platform>
)
