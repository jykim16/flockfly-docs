# Flockdoc Platform header plan

## Test scenarios

1. Header brand is “Flockfly Platform” and links to the Platform home hash route.
2. Navigation contains Skills, Routers, Sessions, Flockdoc, and Getting started in Platform order with canonical hash URLs.
3. Flockdoc retains `aria-current="page"`.
4. An authenticated `/v1/me` response places the user email and Pro badge in the account link.
5. An unauthenticated preview retains its preview workspace status.

## Implementation checklist

- [x] Compare Platform and Flockdoc header source and live behavior.
- [x] Add failing header-parity tests.
- [x] Implement markup, session data, and CSS parity.
- [x] Run focused and full tests.
- [x] Run the production build.
- [x] Commit without pushing.
- [x] Deploy CloudFront and visually verify the canonical page.

## Risks

- Flockdoc is a separately built artifact, so parity is intentionally tested against the Platform contract to prevent silent drift.
- Mobile header height must be allowed to expand because Platform wraps its navigation.
