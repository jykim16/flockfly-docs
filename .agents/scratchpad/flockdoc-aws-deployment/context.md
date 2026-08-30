# Flockdoc AWS deployment context

## Summary

Flockdoc is a standalone React/Vite repository. The existing Flockfly backend owns authentication, authorization, metadata, collaboration, RDS, Redis, and object storage and is deployed by the existing backend CDK app. The frontend must not become a Context Router package dependency.

## Requirements

- Host the Flockdoc frontend in AWS while keeping the public product URL on `platform.flockfly.ai/flockdoc/`.
- Keep assets private at rest and serve them only through CloudFront.
- Support client-side routes with `index.html` fallbacks.
- Keep `/v1/*` on the existing Vercel platform rewrite so browser API calls remain same-origin.
- Reuse the existing `platform.flockfly.ai` hostname and certificate; do not provision a second public hostname or certificate.
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
  -> private S3 bucket under /flockdoc
  -> generated CloudFront implementation origin
  -> Vercel external rewrite for platform.flockfly.ai/flockdoc/*

Browser /v1/*
  -> existing Vercel API rewrite
  -> api.flockfly.ai
```

## Implementation paths

- `infra/lib/flockdoc-web-stack.ts`: web delivery resources.
- `infra/bin/flockdoc-infra.ts`: CDK app and context parsing.
- `infra/test/flockdoc-web-stack.test.ts`: synthesized-template assertions.
- `src/lib/api.ts`: production same-origin API default.
- `README.md`: deployment workflow and current data behavior.

## Resolved public routing

The selected architecture uses `platform.flockfly.ai/flockdoc/`. CDK emits the generated CloudFront origin URL, which is stored as `FLOCKDOC_ORIGIN` in the platform Vercel project. The Flockdoc repository remains standalone; only the platform-owned routing configuration changes in the backend repository.
