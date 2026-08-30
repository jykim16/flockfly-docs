# Flockdoc AWS deployment context

## Summary

Flockdoc is a standalone React/Vite repository. The existing Flockfly backend owns authentication, authorization, metadata, collaboration, RDS, Redis, and object storage and is deployed by the existing backend CDK app. The frontend must not become a Context Router package dependency.

## Requirements

- Host the production frontend entirely in AWS.
- Keep assets private at rest and serve them only through CloudFront.
- Support client-side routes with `index.html` fallbacks.
- Proxy `/v1/*` to `api.flockfly.ai` without caching so browser API calls remain same-origin.
- Allow an ACM certificate and custom domain to be attached when DNS is ready.
- Keep stack outputs sufficient for CI deployment and cache invalidation.
- Preserve the local development API default while using same-origin API paths in production.

## Existing patterns

- Backend infrastructure uses AWS CDK v2 TypeScript in `flockfly-backend/context-router/infra`.
- Production backend endpoint: `api.flockfly.ai`.
- Frontend build output: `dist/`.
- The frontend has no persisted demo data and currently runs locally.

## Dependency map

```text
Vite build (dist)
  -> CDK BucketDeployment
  -> private S3 bucket
  -> CloudFront distribution
       /v1/* -> api.flockfly.ai
       /*    -> S3 origin
```

## Implementation paths

- `infra/lib/flockdoc-web-stack.ts`: web delivery resources.
- `infra/bin/flockdoc-infra.ts`: CDK app and context parsing.
- `infra/test/flockdoc-web-stack.test.ts`: synthesized-template assertions.
- `src/lib/api.ts`: production same-origin API default.
- `README.md`: deployment workflow and current data behavior.

## Uncertainty

The final custom hostname is not yet confirmed. The first stack therefore deploys to a CloudFront hostname and accepts optional `domainName` plus a complete us-east-1 ACM certificate ARN when available.
