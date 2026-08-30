import path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";

export interface FlockdocWebStackProps extends cdk.StackProps {
  readonly webAssetPath?: string;
}

export class FlockdocWebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FlockdocWebStackProps) {
    super(scope, id, props);

    const webBucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const spaRewrite = new cloudfront.Function(this, "SpaRewrite", {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri === '/flockdoc') {
    request.uri = '/flockdoc/index.html';
    return request;
  }
  if (!uri.startsWith('/flockdoc/')) {
    return request;
  }
  var lastSegment = uri.split('/').pop();
  if (uri.endsWith('/') || !lastSegment.includes('.')) {
    request.uri = '/flockdoc/index.html';
  }
  return request;
}`),
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        compress: true,
        functionAssociations: [{
          function: spaRewrite,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
    });

    new s3deploy.BucketDeployment(this, "DeployWebAssets", {
      destinationBucket: webBucket,
      destinationKeyPrefix: "flockdoc",
      sources: [s3deploy.Source.asset(props.webAssetPath ?? path.resolve(__dirname, "../../dist"))],
      distribution,
      distributionPaths: ["/*"],
      prune: true,
    });

    new cdk.CfnOutput(this, "DistributionUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, "FlockdocOriginUrl", {
      value: `https://${distribution.distributionDomainName}/flockdoc`,
    });
    new cdk.CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new cdk.CfnOutput(this, "WebBucketName", { value: webBucket.bucketName });
  }
}
