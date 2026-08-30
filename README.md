# Flockdoc

Flockdoc is the collaborative document workspace for Flockfly. A saved object is a **flockdoc** and has one of two types:

- **Paper** — a rich-text document.
- **Spreadsheet** — a workbook.

The frontend is intentionally a separate repository. Authentication, storage, permissions, comments, revision history, sharing, and agent identity live in the existing Flockfly backend.

## Run locally

```bash
npm install
npm run dev
```

The app opens at `http://localhost:3003/`. It starts with an empty local workspace until an authenticated backend session is configured.

## Checks

```bash
npm test
npm run build
```

## Deploy to AWS

The standalone CDK app in `infra/` deploys the Vite build to a private,
versioned S3 bucket behind CloudFront. CloudFront serves SPA routes and proxies
uncached `/v1/*` requests to `api.flockfly.ai`, so production API calls remain
same-origin.

```bash
npm install
npm --prefix infra install
npm run infra:test
npm run infra:synth

# Once per AWS account and region
npm --prefix infra exec -- cdk bootstrap aws://<account-id>/us-west-2

# Deploy using the generated cloudfront.net hostname
npm run deploy:aws
```

The `DistributionUrl`, `DistributionId`, and `WebBucketName` CloudFormation
outputs are suitable for CI verification and cache invalidation.

To attach a custom hostname, first issue or import its ACM certificate in
`us-east-1` (CloudFront's required certificate region), then deploy with both
values:

```bash
npm --prefix infra run deploy -- \
  -c domainName=flockdoc.flockfly.ai \
  -c certificateArn=arn:aws:acm:us-east-1:<account-id>:certificate/<id>
```

Point the hostname's DNS record at the CloudFront distribution after deployment.

## WebMCP

When the host browser exposes `document.modelContext`, the app registers:

- `flockdoc.list`
- `flockdoc.create`
- `flockdoc.rename`
- `flockdoc.share`
- `flockdoc.comment`
- `paper.update`
- `spreadsheet.update`

The tool boundary is implemented in `src/lib/webmcp.ts`. The same application actions are intended to back human UI operations and agent tool calls so permissions and audit behavior do not diverge.

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for architecture, delivered scope, and the remaining production milestones.
