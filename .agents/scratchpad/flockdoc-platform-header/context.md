# Flockdoc Platform header context

## Goal

Make the Flockdoc header match the authenticated Context Router header at `platform.flockfly.ai` while retaining Flockdoc as the active destination.

## Existing documentation

- `README.md` defines Flockdoc as a separately built frontend served through the Platform hostname.
- No repository-specific `CODEASSIST.md` exists.

## Source of truth

The Platform header in `flockfly-backend/context-router/ui/src/App.tsx` contains the Flockfly Platform brand, Skills, Routers, Sessions, Flockdoc, Getting started, and the signed-in account chip. Its layout rules live in `context-router/ui/src/index.css`.

## Current mismatch

Flockdoc labels the brand “Flockfly Flockdoc,” omits Getting started, uses non-hash Platform links, shows a workspace-status chip instead of the signed-in account, adds a custom active underline, and hides most navigation on mobile.

## Dependency map

`FlockdocApi.session()` → current user/billing state → `App` → `PlatformHeader` account chip.

`PlatformHeader` → canonical Platform hash routes and Flockdoc route → Platform navigation.

## Requirements

- Use the same brand, five navigation destinations, ordering, link format, spacing, typography, and responsive behavior as Platform.
- Keep Flockdoc marked semantically as the current page.
- Show the authenticated email and Pro badge when returned by `/v1/me`.
- Preserve the preview workspace indicator when no Platform session exists.

## React guidance

Keep the header static and pass only primitive account fields from the existing session request. Do not add another fetch or a new client-state dependency.
