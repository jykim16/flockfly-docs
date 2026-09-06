# Flockdoc

Flockdoc is the collaborative document workspace for Flockfly. A saved object is a **flockdoc** and has one of three types:

**Live app:** [https://platform.flockfly.ai/flockdoc/](https://platform.flockfly.ai/flockdoc/)

- **Paper** — a rich-text document.
- **Spreadsheet** — a workbook.
- **Diagram** — a collaborative Excalidraw canvas based on the `excalidraw-mcp` implementation.

The frontend is intentionally a separate repository. Authentication, storage, permissions, content-anchored comments, revision history, sharing, and agent identity live in the existing Flockfly backend. Flockdocs carry a slash-delimited path prefix; the workspace derives virtual folders from those prefixes, so moving a file to a new path implicitly creates the folder hierarchy. Files also support recoverable deletion.

## Run locally

```bash
npm install
npm run dev
```

The app opens at `http://localhost:3003/flockdoc/`. It starts with an empty local workspace until an authenticated backend session is configured.

## Checks

```bash
npm test
npm run build
```

## Deploy to AWS

The standalone CDK app in `infra/` deploys the Vite build to a private,
versioned S3 bucket behind CloudFront. The build and deployed objects live below
`/flockdoc/`. The existing Vercel project for `platform.flockfly.ai` rewrites
that public path to the generated CloudFront origin, while `/v1/*` continues to
use the platform's existing API rewrite.

```bash
npm install
npm --prefix infra install
npm run infra:test
npm run infra:synth

# Once per AWS account and region
npm --prefix infra exec -- cdk bootstrap aws://<account-id>/us-west-2

# Deploy the private implementation origin
npm run deploy:aws
```

The `FlockdocOriginUrl`, `DistributionUrl`, `DistributionId`, and `WebBucketName`
CloudFormation outputs are suitable for platform configuration, CI verification,
and cache invalidation.

Set `FLOCKDOC_ORIGIN` on the Vercel project that serves `platform.flockfly.ai`
to the `DistributionUrl` value (for example,
`https://d123example.cloudfront.net`) and redeploy that project. The user-facing
URL is then:

```bash
https://platform.flockfly.ai/flockdoc/
```

No additional public hostname, DNS record, or ACM certificate is required.

## WebMCP

When the host browser exposes `document.modelContext`, the app registers:

- `flockdoc.list`
- `flockdoc.open`
- `flockdoc.create`
- `flockdoc.rename`
- `flockdoc.move`
- `flockdoc.delete`

An open editor also registers tools for its document type:

- Paper: `read_me`, `inspect_document`, `read_document`, and `write_document` for editors.
- Spreadsheet: workbook inspection, range reads/writes, formatting, grid, merge, and sheet-management tools.
- Diagram: `read_me`, `inspect_diagram`, `read_diagram`, plus element upsert/delete tools for editors.

View-only collaborators receive inspection and read tools, but no mutation tools. Paper and Diagram tool edits use the same save, realtime collaboration, offline recovery, and permission paths as edits made in the editor UI.

Diagram scenes use the same authenticated revision, checkpoint, presence, offline recovery, and sharing infrastructure as Papers and Spreadsheets.

The tool boundary is implemented in `src/lib/webmcp.ts`. The same application actions are intended to back human UI operations and agent tool calls so permissions and audit behavior do not diverge.

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for architecture, delivered scope, and the remaining production milestones.
