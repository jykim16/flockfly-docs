import path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";

export interface FlockdocWebStackProps extends cdk.StackProps {
  readonly webAssetPath?: string;
  readonly apiDomainName: string;
  readonly domainName?: string;
  readonly certificateArn?: string;
}

export class FlockdocWebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FlockdocWebStackProps) {
    super(scope, id, props);

    if (props.domainName && !props.certificateArn) {
      throw new Error("certificateArn is required when domainName is configured.");
    }
    if (props.certificateArn && !props.domainName) {
      throw new Error("domainName is required when certificateArn is configured.");
    }

    const webBucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const certificate = props.certificateArn
      ? acm.Certificate.fromCertificateArn(this, "WebCertificate", props.certificateArn)
      : undefined;

    const spaRewrite = new cloudfront.Function(this, "SpaRewrite", {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.split('/').pop();
  if (uri.endsWith('/') || !lastSegment.includes('.')) {
    request.uri = '/index.html';
  }
  return request;
}`),
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      domainNames: props.domainName ? [props.domainName] : undefined,
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
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
      additionalBehaviors: {
        "/v1/*": {
          origin: new origins.HttpOrigin(props.apiDomainName, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            httpsPort: 443,
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
      },
    });

    new s3deploy.BucketDeployment(this, "DeployWebAssets", {
      destinationBucket: webBucket,
      sources: [s3deploy.Source.asset(props.webAssetPath ?? path.resolve(__dirname, "../../dist"))],
      distribution,
      distributionPaths: ["/*"],
      prune: true,
    });

    new cdk.CfnOutput(this, "DistributionUrl", {
      value: props.domainName ? `https://${props.domainName}` : `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new cdk.CfnOutput(this, "WebBucketName", { value: webBucket.bucketName });
  }
}
