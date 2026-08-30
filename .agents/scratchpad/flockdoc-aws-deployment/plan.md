# Flockdoc AWS deployment plan

## Test scenarios

1. Synthesizing the default stack creates a private, encrypted, versioned S3 bucket.
2. CloudFront uses `index.html` as the root and rewrites 403/404 responses to the SPA entry point.
3. CloudFront proxies `/v1/*` to the configured HTTPS API origin with caching disabled and all API methods enabled.
4. A custom domain is rejected unless a certificate ARN is supplied.
5. When a domain and certificate are supplied, the distribution includes the alias and certificate.
6. The frontend production build uses same-origin API requests while local development retains the localhost API.

## Implementation checklist

- [x] Write CDK template tests and confirm RED.
- [x] Implement the CDK app and web stack.
- [x] Add production API URL behavior and deployment scripts.
- [x] Document bootstrap, synth, deploy, custom domain, and outputs.
- [x] Run infrastructure tests, typecheck, synth, frontend tests, and frontend build.
- [x] Review synthesized security and caching configuration.
- [x] Commit the verified implementation.

## Security and operations

- S3 public access remains fully blocked and origin access uses CloudFront OAC.
- TLS is redirected at the edge.
- Static assets use optimized caching; `/v1/*` uses disabled caching.
- Buckets and deployed assets are retained by default to avoid destructive teardown.
- Custom-domain certificates must be issued in us-east-1 for CloudFront.
