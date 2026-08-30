#!/usr/bin/env node
import path from "node:path";
import * as cdk from "aws-cdk-lib";
import { FlockdocWebStack } from "../lib/flockdoc-web-stack";

const app = new cdk.App();
const domainName = app.node.tryGetContext("domainName");
const certificateArn = app.node.tryGetContext("certificateArn");

new FlockdocWebStack(app, "FlockdocWeb", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-west-2",
  },
  webAssetPath: path.resolve(__dirname, "../../dist"),
  apiDomainName: app.node.tryGetContext("apiDomain") ?? "api.flockfly.ai",
  domainName: typeof domainName === "string" && domainName ? domainName : undefined,
  certificateArn: typeof certificateArn === "string" && certificateArn ? certificateArn : undefined,
});

app.synth();
