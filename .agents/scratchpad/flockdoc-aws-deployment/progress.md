# Flockdoc AWS deployment progress

- [x] Parameters resolved in automatic mode.
- [x] Repository boundaries and existing CDK patterns explored.
- [x] Context and dependency map documented.
- [x] Test strategy and implementation plan documented.
- [x] RED: infrastructure tests fail before implementation.
- [x] GREEN: stack tests and synth pass.
- [x] Frontend production wiring verified.
- [x] Full validation complete.
- [x] Commit recorded.

## Decisions

- The frontend CDK app lives in `flockfly-docs/infra`, keeping the web product independent from Context Router.
- The existing shared backend remains behind `api.flockfly.ai`; the platform Vercel project continues to provide the same-origin `/v1/*` behavior.
- The public URL is `https://platform.flockfly.ai/flockdoc/` under the existing hostname and certificate.
- CloudFront is a generated implementation origin only and requires no custom alias or ACM certificate.

## TDD log

- RED confirmed: `test/flockdoc-web-stack.test.ts` failed because `lib/flockdoc-web-stack.ts` did not exist.
- GREEN confirmed: five CDK assertions pass, including private storage, SPA fallback, API proxy, and custom-domain validation.
- Infrastructure typecheck and `cdk synth` pass.
- Frontend tests and production build pass.
- Synthesized template includes CloudFront OAC, HTTPS redirects, optimized static caching, and disabled `/v1/*` caching.
- Refactor: replaced distribution-wide error responses with a static-behavior-only viewer-request rewrite so API 404 responses remain intact.
- `npm audit` reports zero production or development vulnerabilities after upgrading the infrastructure test runner.
- Shared-hostname update: two CDK tests, six Vercel routing tests, four Flockdoc tests, and all 55 platform UI tests pass.
- Both production builds and CDK synthesis pass; the Flockdoc build emits `/flockdoc/assets/*` URLs.
- The platform's Node 26 test environment now supplies an in-memory `localStorage` fallback when jsdom does not provide one.

## Commit

- `c59139f feat: add AWS deployment infrastructure`
