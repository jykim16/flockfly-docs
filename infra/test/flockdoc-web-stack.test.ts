import path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { FlockdocWebStack } from "../lib/flockdoc-web-stack";

const assetPath = path.join(__dirname, "fixtures", "site");

function templateFor(props: Partial<ConstructorParameters<typeof FlockdocWebStack>[2]> = {}) {
  const app = new cdk.App();
  const stack = new FlockdocWebStack(app, "TestFlockdocWeb", {
    webAssetPath: assetPath,
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

  it("serves the SPA below the flockdoc path without an API proxy or alias", () => {
    const template = templateFor();
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: "index.html",
        Aliases: Match.absent(),
        CustomErrorResponses: Match.absent(),
        DefaultCacheBehavior: Match.objectLike({
          FunctionAssociations: Match.arrayWith([Match.objectLike({ EventType: "viewer-request" })]),
        }),
        CacheBehaviors: Match.absent(),
      }),
    });
    template.hasResourceProperties("AWS::CloudFront::Function", {
      FunctionConfig: Match.objectLike({ Runtime: "cloudfront-js-2.0" }),
      FunctionCode: Match.stringLikeRegexp("/flockdoc/index\\.html"),
    });
    template.hasResourceProperties("Custom::CDKBucketDeployment", {
      DestinationBucketKeyPrefix: "flockdoc",
    });
    template.hasOutput("DistributionUrl", { Value: Match.anyValue() });
    template.hasOutput("FlockdocOriginUrl", { Value: Match.anyValue() });
    template.hasOutput("DistributionId", { Value: Match.anyValue() });
    template.hasOutput("WebBucketName", { Value: Match.anyValue() });
  });
});
