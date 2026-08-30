import path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { FlockdocWebStack } from "../lib/flockdoc-web-stack";

const assetPath = path.join(__dirname, "fixtures", "site");

function templateFor(props: Partial<ConstructorParameters<typeof FlockdocWebStack>[2]> = {}) {
  const app = new cdk.App();
  const stack = new FlockdocWebStack(app, "TestFlockdocWeb", {
    webAssetPath: assetPath,
    apiDomainName: "api.flockfly.ai",
    ...props,
  });
  return Template.fromStack(stack);
}

describe("FlockdocWebStack", () => {
  it("keeps versioned, encrypted web assets private", () => {
    const template = templateFor();
    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      VersioningConfiguration: { Status: "Enabled" },
    });
  });

  it("serves the SPA and proxies uncached API traffic", () => {
    const template = templateFor();
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: "index.html",
        CustomErrorResponses: Match.absent(),
        DefaultCacheBehavior: Match.objectLike({
          FunctionAssociations: Match.arrayWith([Match.objectLike({ EventType: "viewer-request" })]),
        }),
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: "/v1/*",
            AllowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
            ViewerProtocolPolicy: "redirect-to-https",
          }),
        ]),
        Origins: Match.arrayWith([
          Match.objectLike({ DomainName: "api.flockfly.ai", CustomOriginConfig: Match.anyValue() }),
        ]),
      }),
    });
    template.hasResourceProperties("AWS::CloudFront::Function", {
      FunctionConfig: Match.objectLike({ Runtime: "cloudfront-js-2.0" }),
      FunctionCode: Match.stringLikeRegexp("index\\.html"),
    });
    template.hasOutput("DistributionUrl", { Value: Match.anyValue() });
    template.hasOutput("DistributionId", { Value: Match.anyValue() });
    template.hasOutput("WebBucketName", { Value: Match.anyValue() });
  });

  it("requires a certificate when a custom domain is configured", () => {
    const app = new cdk.App();
    expect(() => new FlockdocWebStack(app, "InvalidDomain", {
      webAssetPath: assetPath,
      apiDomainName: "api.flockfly.ai",
      domainName: "flockdoc.flockfly.ai",
    })).toThrow(/certificateArn/);
  });

  it("requires a CloudFront certificate from us-east-1", () => {
    const app = new cdk.App();
    expect(() => new FlockdocWebStack(app, "WrongCertificateRegion", {
      webAssetPath: assetPath,
      apiDomainName: "api.flockfly.ai",
      domainName: "flockdoc.flockfly.ai",
      certificateArn: "arn:aws:acm:us-west-2:123456789012:certificate/00000000-0000-0000-0000-000000000000",
    })).toThrow(/us-east-1/);
  });

  it("attaches an optional custom hostname and certificate", () => {
    const template = templateFor({
      domainName: "flockdoc.flockfly.ai",
      certificateArn: "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000000",
    });
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({ Aliases: ["flockdoc.flockfly.ai"] }),
    });
  });
});
