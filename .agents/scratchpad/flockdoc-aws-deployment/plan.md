# Flockdoc AWS deployment plan

## Test scenarios

1. Synthesizing the default stack creates a private, encrypted, versioned S3 bucket.
2. CloudFront rewrites extensionless `/flockdoc/*` routes to `/flockdoc/index.html`.
3. The deployment places the Vite build below the `flockdoc` S3 key prefix.
4. The distribution has no custom alias, certificate, or `/v1/*` behavior.
5. The platform Vercel configuration preserves `/v1/*` and externally rewrites `/flockdoc/*` to a validated HTTPS `FLOCKDOC_ORIGIN`.
6. The frontend build emits asset URLs below `/flockdoc/assets/`.

## Implementation checklist

- [x] Write CDK template tests and confirm RED.
- [x] Implement the CDK app and web stack.
- [x] Add production API URL behavior and deployment scripts.
- [x] Document bootstrap, synth, deploy, custom domain, and outputs.
- [x] Run infrastructure tests, typecheck, synth, frontend tests, and frontend build.
- [x] Review synthesized security and caching configuration.
- [x] Commit the verified implementation.
- [x] Replace custom-hostname infrastructure with the shared platform path architecture.
- [x] Add tested build-time Vercel routing configuration.
- [x] Run full Flockdoc and platform UI regression suites.

## Security and operations

- S3 public access remains fully blocked and origin access uses CloudFront OAC.
- TLS is redirected at the edge.
- Static assets use optimized caching; API traffic never traverses the Flockdoc distribution.
- Buckets and deployed assets are retained by default to avoid destructive teardown.
- The generated CloudFront hostname uses its default certificate and is not exposed as the product URL.
