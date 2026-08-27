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

// Redis cluster (OT Container Redis operator)
function RedisCluster() {
  return (
    <rediscluster
      apiVersion="redis.redis.opstreelabs.in/v1beta2"
      kind="RedisCluster"
      metadata={{ name: 'wejay-cache', namespace: 'wejay' }}
      spec={{
        clusterSize: 1,
        persistenceEnabled: false,
        kubernetesConfig: {
          image: 'redis:7.2-alpine',
          imagePullPolicy: 'IfNotPresent',
          resources: {
            requests: { cpu: '100m', memory: '128Mi' },
            limits: { cpu: '500m', memory: '512Mi' },
          },
        },
      }}
    />
  )
}

// TLS certificate for wejay.dmz.berget.ai
function WejayCert() {
  return (
    <certificate
      apiVersion="cert-manager.io/v1"
      kind="Certificate"
      metadata={{ name: 'wejay-tls', namespace: 'wejay' }}
      spec={{
        secretName: 'wejay-tls',
        dnsNames: ['wejay.dmz.berget.ai'],
        issuerRef: { name: 'letsencrypt-prod', kind: 'ClusterIssuer' },
      }}
    />
  )
}

// HTTPRoute to shared dmz gateway
// Uses sharedGateway to avoid per-app LoadBalancer IP
function WejayRoute() {
  return (
    <httproute
      apiVersion="gateway.networking.k8s.io/v1"
      kind="HTTPRoute"
      metadata={{
        name: 'wejay-endpoint-route',
        namespace: 'wejay',
        annotations: {
          'external-dns.alpha.kubernetes.io/hostname': 'wejay.dmz.berget.ai',
        },
      }}
      spec={{
        parentRefs: [{ name: 'dmz-shared-gateway', namespace: 'envoy-gateway-system' }],
        hostnames: ['wejay.dmz.berget.ai'],
        rules: [
          {
            backendRefs: [{ name: 'wejay', port: 80 }],
          },
        ],
      }}
    />
  )
}

// BackendTrafficPolicy for WebSocket/Socket.IO support
function WejayTrafficPolicy() {
  return (
    <backendtrafficpolicy
      apiVersion="gateway.envoyproxy.io/v1alpha1"
      kind="BackendTrafficPolicy"
      metadata={{ name: 'wejay-websocket', namespace: 'wejay' }}
      spec={{
        targetRefs: [
          { group: 'gateway.networking.k8s.io', kind: 'HTTPRoute', name: 'wejay-endpoint-route' },
        ],
        timeout: {
          http: { requestTimeout: '0s' },
        },
        connection: {
          bufferLimit: 10485760,
        },
      }}
    />
  )
}

export default (
  <Platform namespace="wejay">
    <VaultServiceAccount />
    <VaultAuth />
    <WejaySecrets />
    <RedisCluster />
    <WejayCert />
    <WejayRoute />
    <WejayTrafficPolicy />
    <App
      name="wejay"
      image={image}
      port={8080}
      replicas={2}
      cache={false}
      env={{
        NODE_ENV: 'production',
        REDIS_URL: 'redis://wejay-cache-leader.wejay.svc.cluster.local:6379',
      }}
      secrets={{
        VITE_SPOTIFY_CLIENT_ID: { secret: 'wejay-secret', key: 'spotify-client-id' },
        CLIENT_SECRET: { secret: 'wejay-secret', key: 'spotify-client-secret' },
        BERGET_API_KEY: { secret: 'wejay-secret', key: 'berget-api-key' },
      }}
      resources={{
        requests: { cpu: '100m', memory: '128Mi' },
        limits: { cpu: '500m', memory: '512Mi' },
      }}
    />
  </Platform>
)
