import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnDistribution } from "aws-cdk-lib/aws-cloudfront";
import { NuxtProps } from './NuxtProps';
import { ServerConstruct, ClientConstruct } from '../lib'

export class NuxtStack extends Stack {

  constructor(scope: Construct, id: string, props: NuxtProps) {
    super(scope, id, props);

    // Check mandatory properties
    if (!props?.env) {
      throw new Error('Must provide AWS account and region.');
    }
    if (!props.application || !props.environment || !props.service) {
      throw new Error('Mandatory stack properties missing.');
    }

    // Create the server construct
    const server = new ServerConstruct(this, 'Server', props);

    // Create the client construct
    const client = new ClientConstruct(this, 'Client', props, {
      httpOrigin: server?.httpOrigin,
    });

    /**
     * Origin Access Control (OAC) patch
     * Adapted from: https://github.com/awslabs/cloudfront-hosting-toolkit
     * 
     * Patch is needed because no native support from AWS.
     * https://github.com/aws/aws-cdk/issues/21771
     */
    const cfnDistribution = client?.cdn.node.defaultChild as CfnDistribution;
    cfnDistribution.addOverride(
      "Properties.DistributionConfig.Origins.1.S3OriginConfig.OriginAccessIdentity",
      ""
    );
    cfnDistribution.addPropertyOverride(
      "DistributionConfig.Origins.1.OriginAccessControlId",
      client.originAccessControl?.getAtt("Id")
    );

    // remove the second statement entirely (the one with Principal.CanonicalUser)
    // const comS3PolicyOverride = client?.staticAssetsBucket.node.findChild("Policy").node.defaultChild as CfnBucketPolicy;
    // const statements = comS3PolicyOverride.policyDocument.statements;
    // statements.splice(1, 1);

    const s3OriginNode = client?.cdn.node
      .findAll()
      .filter((child) => child.node.id === "S3Origin");

    if (s3OriginNode && s3OriginNode.length > 0) {
      const resourceNode = s3OriginNode[0].node.findChild("Resource");
      if (resourceNode) {
        resourceNode.node.tryRemoveChild("Resource")
      }
    };
    // End of OAC patch

  }
}