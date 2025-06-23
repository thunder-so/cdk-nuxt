# CDK Nuxt

<p>
    <a href="https://github.com/thunder-so/cdk-nuxt/actions/workflows/publish.yml"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/thunder-so/cdk-nuxt/publish.yml?logo=github" /></a>
    <a href="https://www.npmjs.com/package/@thunderso/cdk-nuxt"><img alt="Version" src="https://img.shields.io/npm/v/@thunderso/cdk-nuxt.svg" /></a>
    <a href="https://www.npmjs.com/package/@thunderso/cdk-nuxt"><img alt="Downloads" src="https://img.shields.io/npm/dm/@thunderso/cdk-nuxt.svg"></a>
    <a href="https://www.npmjs.com/package/@thunderso/cdk-nuxt"><img alt="License" src="https://img.shields.io/npm/l/@thunderso/cdk-nuxt.svg" /></a>
</p>

Deploy full-stack Nuxt applications on AWS and CI/CD with GitHub Actions.


## Features

- Server-side rendering (SSR) with [Lambda](https://aws.amazon.com/lambda/) for dynamic content generation and API
- Automatic upload of the static assets to [S3](https://aws.amazon.com/s3/) with optimized caching rules
- Fast responses for static assets from CDN using [CloudFront](https://aws.amazon.com/cloudfront/)
- Automatic upload of the build files and static assets to [S3](https://aws.amazon.com/s3/) with optimized caching rules
- Publicly available by a custom domain (or subdomain) via [Route53](https://aws.amazon.com/route53/) and SSL via [Certificate Manager](https://aws.amazon.com/certificate-manager/)
- Build and deploy with [Github Actions](https://docs.github.com/en/actions)
- Optional: Use Dockerfile to use container image Lambda


## Prerequisites

You need an [AWS account](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/) to create and deploy the required resources for the site on AWS.

Before you begin, make sure you have the following:
  - Node.js and npm: Ensure you have Node.js (v18 or later) and npm installed.
  - AWS CLI: Install and configure the AWS Command Line Interface.

  - AWS CDK: Install the AWS CDK globally
```
npm install -g aws-cdk
```

  - Before deploying, bootstrap your AWS environment:
```
cdk bootstrap aws://your-aws-account-id/us-east-1
```

This package uses the `npm` package manager and is an ES6+ Module.


## Installation

Navigate to your project directory and install the package and its required dependencies. 

Your `package.json` must also contain the latest `tsx` and `cdk-nuxt`:

```bash
npm i tsx @thunderso/cdk-nuxt --save-dev
```


## Setup

1. Login into the AWS console and note the `Account ID`. You will need it in the configuration step.

2. Run the following commands to create the required CDK stack entrypoint at `stack/index.ts`. 

```bash
mkdir stack
cd stack
touch index.ts 
```

You should adapt the file to your project's needs.

> [!NOTE]
> Use different filenames such as `production.ts` and `dev.ts` for environments.


## Configuration

```ts
// stack/index.ts
import { Cdk, NuxtStack, type NuxtProps } from "@thunderso/cdk-nuxt";

const nuxtApp: NuxtProps = {
  env: {
    account: 'your-account-id',
    region: 'us-west-2'
  },
  application: 'your-application-id',
  service: 'your-service-id',
  environment: 'production',

  rootDir: '', // supports monorepos. e.g. app/

  // ... other props
};

new NuxtStack(
    new Cdk.App(), 
    `${nuxtApp.application}-${nuxtApp.service}-${nuxtApp.environment}-stack`, 
    nuxtApp
);
```

Update your `nuxt.config.ts` to include the optimal settings for deployment on AWS:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  /// ... other configs

  vite: {
    vue: {
      script: {
        defineModel: true,
        propsDestructure: true,
      },
    },
    build: {
        target: 'esnext',
    }
  },

  nitro: {
    preset: 'aws-lambda',
    esbuild: {
        options: {
            target: 'esnext'
        },
    },
    experimental: {
      wasm: true
    },
  },
});
```

- Vite is a fast frontend build tool that improves development speed and optimizes builds, especially for frameworks like Vue and Nuxt. The vite options enable advanced Vue features (`defineModel`, `propsDestructure`), set the build target to modern JavaScript (`esnext`),

- Nitro is Nuxt's server engine, responsible for building and deploying server-side code. The nitro options set the deployment target to AWS Lambda (`preset: 'aws-lambda'`) and ensure server code is also built for modern JavaScript (`esnext`), improving performance and compatibility with AWS environments.


# Deploy

Run `npm run build` before you deploy.

By running the following script, the CDK stack will be deployed to AWS.

```bash
npx cdk deploy --all --app="npx tsx stack/index.ts" 
```


## Deploy using GitHub Actions

In your GitHub repository, add a new workflow file under `.github/workflows/deploy.yml` with the following content:

```yaml .github/workflows/deploy.yml
name: Deploy Nuxt to AWS

on:
  push:
    branches:
      - main  # or the branch you want to deploy from

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Deploy to AWS
        run: |
          npx cdk deploy --require-approval never --all --app="npx tsx stack/index.ts"
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_DEFAULT_REGION: 'us-east-1'  # or your preferred region
```

Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as repository secrets in GitHub. These should be the access key and secret for an IAM user with permissions to deploy your stack.


## Destroy the Stack

If you want to destroy the stack and all its resources (including storage, e.g., access logs), run the following script:

```bash
npx cdk destroy --all --app="npx tsx stack/index.ts" 
```



# Manage Domain with Route53

1. [Create a hosted zone in Route53](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/AboutHZWorkingWith.html) for the desired domain, if you don't have one yet.

This is required to create DNS records for the domain to make the app publicly available on that domain. On the hosted zone details you should see the `Hosted zone ID` of the hosted zone.

2. [Request a public global certificate in the AWS Certificate Manager (ACM)](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html) for the desired domain in `us-east-1` *(global)* and validate it, if you don't have one yet.

This is required to provide the app via HTTPS on the public internet. Take note of the displayed `ARN` for the certificate.

3. [Request a regional certificate in ACM](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request.html) for the same domain in the **same region as your CDK stack**. This is required for API Gateway.

> [!IMPORTANT]
> The `globalCertificateArn` certificate must be issued in `us-east-1` *(global)* regardless of the region used for the app itself as it will be attached to the CloudFront distribution which works globally.
> The `regionalCertificateArn` certificate must be issued in the same region as your stack.

```ts
// stack/index.ts
const nuxtApp: NuxtProps = {
  // ... other props

  // Domain settings
  // - create a hosted zone for your domain in Route53
  // - issue a global TLS certificate in us-east-1 in AWS ACM
  // - issue a regional TLS certificate in the same region as your stack
  domain: 'sub.example.com',
  hostedZoneId: 'XXXXXXXXXXXXXXX',
  globalCertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/abcd1234-abcd-1234-abcd-1234abcd1234', // must be in us-east-1
  regionalCertificateArn: 'arn:aws:acm:us-west-2:123456789012:certificate/efgh5678-efgh-5678-efgh-5678efgh5678', // must match your stack's region
};
```

# Configure the Lambda

Each configuration property provides a means to fine-tune your function’s performance and operational characteristics.

```ts
// stack/index.ts
import { Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';

const nuxtApp: NuxtProps = {
  // ... other props
  
  serverProps: {
    runtime: Runtime.NODEJS_20_X,
    architecture: Architecture.ARM_64,
    memorySize: 1792,
    timeout: 10,
    tracing: false,
    exclude: ['**/*.ts', '**/*.map'],
    keepWarm: true,
  },
};

```

### `runtime`
Specifies the runtime environment for the Lambda function, determining which Lambda runtime API versions are available to the function.
- **Type**: `Runtime`
- **Examples**: `Runtime.NODEJS_20_X`, `Runtime.NODEJS_22_X`
- **Default**: The runtime defaults to `Runtime.NODEJS_20_X`.

### `architecture`
Defines the instruction set architecture that the Lambda function supports.
- **Type**: `Architecture`
- **Examples**: `Architecture.ARM_64`, `Architecture.X86_64`
- **Default**: The architecture defaults to `Architecture.ARM_64`.

### `memorySize`
The amount of memory, in MB, allocated to the Lambda function.
- **Type**: `number`
- **Usage Example**: `memorySize: 512`
- **Default**: 1792 MB

### `timeout`
The function execution time (in seconds) after which Lambda will terminate the running function.
- **Type**: `number`
- **Usage Example**: `timeout: 15`
- **Default**: 10 seconds

### `tracing`
Enables or disables AWS X-Ray tracing for the Lambda function.
- **Type**: `boolean`
- **Usage Example**: `tracing: true`
- **Default**: `false`

### `exclude`
Lists the file patterns that should be excluded from the Lambda deployment package.
- **Type**: `string[]`
- **Usage Example**: `exclude: ['*.test.js', 'README.md']`
- **Default**: []

### `keepWarm`
Enables an EventBridge rule to invoke the Lambda function every 5 minutes, helping to prevent cold starts by keeping the function warm.
- **Type**: `boolean`
- **Default**: `false`
- **Usage Example**: `keepWarm: true`


## Environment variables

Pass environment variables to your lambda function by:

1. `variables`: Array of key-value pairs for plain environment variables.

2. `secrets`: Array of objects with `key` and `resource` (Secrets Manager ARN). The library automatically adds permissions for Lambda to read these secrets.

To create a plaintext secret in AWS Secrets Manager using the AWS CLI:

```bash
aws secretsmanager create-secret --name "your-secret-name" --secret-string "your-secret-value"
```

```ts
// stack/index.ts
const nuxtApp: NuxtProps = {
  // ... other props

  serverProps: {
    // ...other server props

    variables: [
      { NUXT_API_URL: 'https://api.example.com' },
      { NUXT_PUBLIC_ANALYTICS_ID: 'UA-XXXXXX' }
    ],

    secrets: [
      { 
        key: 'API_URL', 
        resource: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:/my-app/API_URL-abc123' 
      },
      { 
        key: 'API_KEY', 
        resource: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:/my-app/API_KEY-def456' 
      },
    ],
  },
};
```

## Scaling Properties

When configuring AWS Lambda functions, understanding scaling properties is essential for efficient resource management and cost optimization. The two primary scaling properties you can configure are `reservedConcurrency` and `provisionedConcurrency`.

```ts
// stack/index.ts
const nuxtApp: NuxtProps = {
  // ... other props
  
  serverProps: {
    // ... other props
    reservedConcurrency: 5,
    provisionedConcurrency: 10,
  },

};
```

### `reservedConcurrency`
Reserved concurrency sets a limit on the number of instances of the function that can run simultaneously. It ensures that your function has access to a specified amount of concurrent executions, preventing it from being throttled if account-level concurrency limits are reached.
- **Use Case**: This is useful when you want to have predictable execution patterns or ensure other functions don't consume all available concurrency.
- **Example**: `reservedConcurrency: 5`

### `provisionedConcurrency`
Provisioned concurrency keeps a set of pre-initialized environments ready to respond immediately to incoming requests. This helps in reducing latency and eliminating cold starts when the function is triggered.
- **Use Case**: Ideal for latency-sensitive applications where response time is critical.
- **Example**: `provisionedConcurrency: 10`

While both reserved and provisioned concurrency deal with execution limits, they serve different purposes. Reserved concurrency guarantees a portion of the total function pool across your AWS account, while provisioned concurrency is specifically about warming up a set number of function instances to achieve low-latency execution.


# Controlling S3 Asset Uploads

You can control which files and folders from your Nuxt build output directory (`.output/public`) are uploaded to S3 by using the `buildProps` options. This is useful for optimizing your deployment by only uploading necessary static assets and excluding unnecessary files (such as source maps, test files, or other artifacts).

```ts
// stack/index.ts
const nuxtApp: NuxtProps = {
  // ... other props

  buildProps: {
    // Only include .js, .css, and .html files
    include: ['**/*.js', '**/*.css', '**/*.html'],
    // Exclude source maps and test files
    exclude: ['**/*.map', '**/*.test.js'],
  },
};
```

- `include`: Lists the file patterns that should be excluded from the S3 deployment package.
- `exclude`: An array of glob patterns specifying which files to exclude from the upload. Exclusions are applied after inclusions.


# Advanced: Configuring CloudFront

## Custom Error Page

You can specify a custom error page to handle `404 Not Found` errors by setting the `errorPagePath` property. This path should be relative to your application's output directory.

```ts stack/index.ts
const nuxtApp: NuxtProps = {
  // ... other props

  // Optional: Custom error page
  errorPagePath: '/404.html', // Relative to the output directory. Defaults to '/index.html'.
};
```

## Custom Headers

You can add custom HTTP response headers to all responses served by CloudFront by specifying the `headers` property in your stack configuration. These headers are automatically bound to the CloudFront Response Headers Policy, allowing you to set any custom metadata required by your application.

```ts
// stack/index.ts
const nuxtApp: NuxtProps = {
  // ... other props

  headers: {
    'X-App-Version': '1.0.0',
    'X-Feature-Flag': 'beta',
    'X-Request-Id': 'random-id',
  },
};
```

The headers property is an object where each key is the header name and the value is the header value.
All custom headers defined here will be included in the CloudFront Response Headers Policy and applied to every response.

> [!WARNING] 
> Security-related headers (such as Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, etc.) and CORS headers are managed separately by the library and cannot be overridden using the headers property. Use this property only for custom application headers.

> [!NOTE] 
> Custom headers are set at the CDN edge and are included in every response, regardless of whether the content is served from the Lambda origin or S3.


## Customize Cache Behavior 

You can fine-tune CloudFront's caching behavior by specifying which `headers`, `cookies`, and `query parameters` to include or exclude in the cache key. This allows you to control how CloudFront caches content and forwards requests to the origin, improving cache efficiency and ensuring dynamic content is handled correctly.

```ts
// stack/index.ts
const nuxtApp: NuxtProps = {
  // ... other props

  // Customize cache behavior
  allowHeaders: ['Accept-Language', 'User-Agent'],
  allowCookies: ['session-*', 'user-preferences'],
  allowQueryParams: ['lang', 'theme'],
  // Or, to exclude specific query parameters
  // denyQueryParams: ['utm_source', 'utm_medium', 'fbclid'],
};
```

- `allowHeaders`: An array of header names to include in the cache key and forward to the origin.
- `allowCookies`: An array of cookie names to include in the cache key and forward to the origin.
- `allowQueryParams`: An array of query parameter names to include in the cache key and forward to the origin.
- `denyQueryParams`: An array of query parameter names to exclude from the cache key and not forward to the origin.

If neither `allowQueryParams` nor `denyQueryParams` are specified, all query parameters are ignored in caching and not forwarded to the origin.

> [!NOTE]
> The `allowQueryParams` and `denyQueryParams` properties are mutually exclusive. If both are provided, denyQueryParams will be ignored.


# Advanced: Using Docker Container

If your Nuxt server bundle exceeds the AWS Lambda deployment package size limit (250 MB unzipped), you can deploy your application as a Lambda function packaged in a Docker container. 

Lambda with container images supports up to 10 GB, making it suitable for large Nuxt server bundles and dependencies.

When to use:

- Your `.output/server` directory or dependencies are too large for a standard Lambda deployment.
- You need custom OS-level dependencies or binaries.
- You want full control over the runtime environment.

Create a `Dockerfile` in your project directory. 

```Dockerfile
FROM public.ecr.aws/lambda/nodejs:22

# Set working directory to /var/task/
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy .output/server directory contents to /var/task/
COPY ./ ./

# Lambda function handler
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["index.handler"]
```

The `.output/server` directory is used as the context for the container.

Reference the `Dockerfile` in your stack configuration:

```ts
// stack/index.ts
const nuxtApp: NuxtProps = {
  // ... other props
  
  serverProps: {
    dockerFile: 'Dockerfile'

    // ...other server props
    // note: runtime will be ignored when using Docker
  },

};

```

Deploy as usual. CDK will build the Docker image and deploy it to AWS Lambda as a container image.


# Troubleshooting

For assistance, consult the AWS documentation or [raise an issue](https://github.com/thunder-so/cdk-nuxt/issues) in the GitHub repository.