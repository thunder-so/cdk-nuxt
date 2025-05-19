import { type StackProps } from "aws-cdk-lib";
import { Runtime, Architecture} from 'aws-cdk-lib/aws-lambda';
import { type ResponseHeadersPolicyProps } from "aws-cdk-lib/aws-cloudfront";

export interface SourceProps {
  readonly owner?: string;
  readonly repo?: string;
  readonly branchOrRef?: string;
  readonly githubAccessTokenArn?: string;
}

export interface BuildProps {
  readonly outputDir?: string;
  readonly include?: string[];
  readonly exclude?: string[];
}

export interface ServerProps {
  readonly runtime?: Runtime;
  readonly architecture?: Architecture;
  readonly codeDir?: string;
  readonly handler?: string;
  readonly paths?: string[];
  readonly include?: string[];
  readonly exclude?: string[];
  readonly memorySize?: number;
  readonly timeout?: number;
  readonly tracing?: boolean;
  readonly environment?: Array<{ [key: string]: string; }>;
  readonly dockerFile?: string;
  readonly dockerBuildArgs?: string[];
}

export interface NuxtProps extends StackProps {

    /**
     * Debug
     */
    readonly debug?: boolean;

    /**
     * The AWS environment (account/region) where this stack will be deployed.
     */
    readonly env: {
      // The ID of your AWS account on which to deploy the stack.
      account: string;
  
      // The AWS region where to deploy the app.
      region: string;
    };
  
    /**
     * A string identifier for the project the app is part of.
     */
    readonly application: string;
  
    /**
     * A string identifier for the project's service the app is created for.
     */
    readonly service: string;
  
    /**
     * A string to identify the environment of the app.
     */
    readonly environment: string;

    /**
     * The path to the root directory of the Nuxt app (at which the `nuxt.config.ts` file is located).
     * Defaults to '.'
     */
    readonly rootDir?: string;

    /**
     * Configure your Github repository
     */
    readonly sourceProps?: SourceProps;
  
    /**
     * Configure the static build outputs 
     */
    readonly buildProps?: BuildProps;

    /**
     * Configure the Lambda function
     */
    readonly serverProps?: ServerProps;

    /**
     * Custom response headers 
     */
    readonly responseHeadersPolicy?: ResponseHeadersPolicyProps;

    readonly headers?: { [key: string]: string; };

    /**
     * Optional. The path to the error page in the output directory. e.g. /404.html
     * Relative to the output directory.
     */
    readonly errorPagePath?: string;

    /**
     * Domains with Route53 and ACM
     */

    // Optional. The domain (without the protocol) at which the app shall be publicly available.
    readonly domain?: string;
  
    // Optional. The ARN of the certificate to use on CloudFront for the app to make it accessible via HTTPS.
    readonly globalCertificateArn?: string;

    // Optional. The ARN of the certificate to use for API Gateway for the app to make it accessible via HTTPS.
    readonly regionalCertificateArn?: string;
  
    // Optional. The ID of the hosted zone to create a DNS record for the specified domain.
    readonly hostedZoneId?: string;


    /**
     * Optional. An array of headers to include in the cache key and pass to the origin on requests.
     * No headers are passed by default.
     */
    readonly allowHeaders?: string[];

    /**
     * Optional. An array of cookies to include in the cache key and pass to the origin on requests.
     * No cookies are passed by default.
     */
    readonly allowCookies?: string[];

    /**
     * Optional. An array of query parameter keys to include in the cache key and pass to the origin on requests.
     * No query parameters are passed by default.
     * You have specific query parameters that alter the content (e.g., ?userId=, ?lang=, etc.).
     * You want to cache different versions of the content based on these parameters.
     */
    readonly allowQueryParams?: string[];

    /**
     * Optional. An array of query param keys to deny passing to the origin on requests.
     * You have query parameters that should be ignored for caching purposes (e.g., tracking parameters like ?utm_source= or ?fbclid=).
     * You want to prevent these parameters from affecting cache performance.
     * Note that this config can not be combined with {@see allowQueryParams}.
     * If both are specified, the {@see denyQueryParams} will be ignored.
     */
    readonly denyQueryParams?: string[];

}