import fs from 'fs';
// @ts-expect-error library not fully ESM compatible
import fse from 'fs-extra/esm';
import path from 'path';
import { Aws, Duration } from "aws-cdk-lib";
import { Construct } from 'constructs';
import { RetentionDays, LogGroup } from 'aws-cdk-lib/aws-logs';
import { Function, Runtime, Architecture, Code, Tracing, DockerImageCode, DockerImageFunction, Alias } from 'aws-cdk-lib/aws-lambda';
import { HttpApi, HttpMethod, DomainName, EndpointType, SecurityPolicy } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { OriginProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Rule, Schedule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { NuxtProps } from '../stack/NuxtProps';

export class ServerConstruct extends Construct {
  private readonly resourceIdPrefix: string;
  private readonly rootDir: string;
  private readonly codeDir: string;
  private lambdaFunction: Function;
  private apiGateway: HttpApi;
  public httpOrigin: HttpOrigin;

  constructor(scope: Construct, id: string, props: NuxtProps) {
    super(scope, id);

    // Set the resource prefix
    this.resourceIdPrefix = `${props.application}-${props.service}-${props.environment}`.substring(0, 42);
    this.rootDir = props.rootDir || './';
    this.codeDir = path.join(this.rootDir, props.serverProps?.codeDir || '.output/server');

    // Include the specified files and directories to output directory
    if (props.serverProps?.include && props.serverProps?.include.length > 0) {
      this.includeFilesAndDirectories(props.serverProps?.include);
    }

    // If Dockerfile is specified, use it to build the Lambda container function
    // Otherwise, use the default Lambda function
    this.lambdaFunction = props.serverProps?.dockerFile
      ? this.createContainerLambdaFunction(props)
      : this.createLambdaFunction(props);

    // Handle provisioned concurrency if specified
    if (props.serverProps?.provisionedConcurrency !== undefined) {
      // Provisioned concurrency requires the creation of a version and an alias
      const version = this.lambdaFunction.currentVersion;
      new Alias(this, 'LambdaAlias', {
        aliasName: 'live',
        version: version,
        provisionedConcurrentExecutions: props.serverProps.provisionedConcurrency,
      });
    }
   
    // Include the environment variables in the Lambda function
    if (props.serverProps?.variables && props.serverProps?.variables?.length > 0) {
      this.addEnvironmentVariables(props.serverProps?.variables || {});
    }
    if (props.serverProps?.secrets && props.serverProps?.secrets?.length > 0) {
      this.addSecrets(props.serverProps?.secrets || {});
    }

    // Create the API gateway to make the Lambda function publicly available
    this.apiGateway = this.createApiGateway(props);

    // Create the API gateway origin to route incoming requests to the Lambda function
    this.httpOrigin = this.createHttpOrigin(props);

    // Create a scheduled rule to ping the Lambda function every 5 minutes
    if (props.serverProps?.keepWarm) {
      this.createPingRule(props);
    }
  }

  /**
   * Include the specified files and directories in the Lambda function code.
   * * @param {string[]} include - The paths to include in the Lambda function code.
   * 
   * @private
   */
  private includeFilesAndDirectories(includes: string[]): void {
    includes.forEach(file => {
      const srcFile = path.join(this.rootDir, file);
      if (fs.existsSync(srcFile)) {
        const destFile = path.join(this.codeDir, file);
        fse.copySync(srcFile, destFile);
      }
    });
  }

  /**
   * Create the container lambda function to render the app.
   * * @param {NuxtProps} props - The properties for the app.
   * * @returns {Function} The Lambda function. 
   * 
   * @private
   */
  private createContainerLambdaFunction(props: NuxtProps): Function {

    // Include the Dockerfile to the .output/server directory
    this.includeFilesAndDirectories([props.serverProps?.dockerFile as string]);

    // Create the Lambda function using the Docker image
    const lambdaFunction = new DockerImageFunction(this, "ContainerFunction", {
      functionName: `${this.resourceIdPrefix}-container-function`,
      description: `Renders the ${this.resourceIdPrefix} app.`,
      architecture: props.serverProps?.architecture || Architecture.ARM_64,
      code: DockerImageCode.fromImageAsset(this.codeDir, {
        buildArgs: {
          NODE_ENV: props.environment,
          ...(Object.fromEntries(
            Object.entries(props.serverProps?.dockerBuildArgs || {}).map(([key, value]) => [key, String(value)])
          )),
        },
        file: props.serverProps?.dockerFile,
        // Exclude files not needed in the Docker build context
        exclude: props.serverProps?.exclude || [],
      }),
      timeout: props.serverProps?.timeout 
        ? Duration.seconds(props.serverProps.timeout) 
        : Duration.seconds(10),
      memorySize: props.serverProps?.memorySize || 1792,
      logGroup: new LogGroup(this, 'ServerFunctionLogGroup', {
        retention: RetentionDays.ONE_MONTH,
      }),
      allowPublicSubnet: false,
      tracing: props.serverProps?.tracing ? Tracing.ACTIVE : Tracing.DISABLED,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        NITRO_PRESET: 'aws-lambda',
      },
      reservedConcurrentExecutions: props.serverProps?.reservedConcurrency,
    });

    return lambdaFunction; 
  }

  /**
   * Creates the Lambda function to render the Nuxt app.
   *
   * @private
   */
  private createLambdaFunction(props: NuxtProps): Function {
    const lambdaFunction = new Function(this, "Function", {
        functionName: `${this.resourceIdPrefix}-function`,
        description: `Renders the ${this.resourceIdPrefix} app.`,
        runtime: props.serverProps?.runtime || Runtime.NODEJS_20_X,
        architecture: props.serverProps?.architecture || Architecture.ARM_64,
        handler: props.serverProps?.handler || 'index.handler',
        code: Code.fromAsset(this.codeDir, {
          exclude: props.serverProps?.exclude || [],
        }),
        timeout: props.serverProps?.timeout 
          ? Duration.seconds(props.serverProps.timeout) 
          : Duration.seconds(10),
        memorySize: props.serverProps?.memorySize || 1792,
        logGroup: new LogGroup(this, 'DockerImageFunctionLogGroup', {
          retention: RetentionDays.ONE_MONTH,
        }),
        allowPublicSubnet: false,
        tracing: props.serverProps?.tracing ? Tracing.ACTIVE : Tracing.DISABLED,
        environment: {
            NODE_OPTIONS: '--enable-source-maps',
            NITRO_PRESET: 'aws-lambda'
        },
        reservedConcurrentExecutions: props.serverProps?.reservedConcurrency,
    });

    return lambdaFunction;
  }

  /**
   * Add environment variables to the Lambda function.
   * @param {Record<string, string>} envVars - The environment variables to add.
   * 
   * @private
   */
  private addEnvironmentVariables(envVars: Array<{ [key: string]: string }>): void {
    envVars.forEach(envVar => {
      Object.entries(envVar).forEach(([key, value]) => {
        this.lambdaFunction.addEnvironment(key, value);
      });
    });
  }

  /**
   * Add secrets from AWS Secrets Manager to the Lambda function environment.
   * @param secrets Array of objects with { key, resource } where resource is the ARN of the secret.
   *
   * @private
   */
  private addSecrets(secrets: Array<{ key: string; resource: string }>): void {
    secrets.forEach(secret => {
      const importedSecret = Secret.fromSecretCompleteArn(
        this,
        `Secret-${secret.key}`,
        secret.resource
      );

      // Add the secret value as an environment variable
      this.lambdaFunction.addEnvironment(secret.key, importedSecret.secretValue.unsafeUnwrap());

      // Grant Lambda permission to read the secret
      importedSecret.grantRead(this.lambdaFunction);
    });
  }

  /**
   * Creates the API gateway to make the Nuxt app render Lambda function publicly available.
   *
   * @private
   */
  private createApiGateway(props: NuxtProps): HttpApi {
    const lambdaIntegration = new HttpLambdaIntegration(`${this.resourceIdPrefix}-lambda-integration`, this.lambdaFunction);

    // We want the API gateway to be accessible by the custom domain name.
    // Even though we access the gateway via CloudFront (for auto http to https redirects), this is required
    // to be able to redirect the original 'Host' header to the Nuxt application, if requested.
    let domainName: DomainName | undefined = undefined;

    if (props.domain && props.regionalCertificateArn) {
      domainName = new DomainName(this, `${this.resourceIdPrefix}-api-domain`, {
        domainName: props.domain,
        certificate: Certificate.fromCertificateArn(this, `${this.resourceIdPrefix}-regional-certificate`, props.regionalCertificateArn),
        endpointType: EndpointType.REGIONAL,
        securityPolicy: SecurityPolicy.TLS_1_2
      });
    };

    const apiGateway = new HttpApi(this, "API", {
      apiName: `${this.resourceIdPrefix}-api`,
      description: `Connects the ${this.resourceIdPrefix} CloudFront distribution with the ${this.resourceIdPrefix} Lambda function to make it publicly available.`,
      // The app does not allow any cross-origin access by purpose: the app should not be embeddable anywhere
      corsPreflight: undefined,
      defaultIntegration: lambdaIntegration,
      ...(domainName && { defaultDomainMapping: { domainName } })
    });

    apiGateway.addRoutes({
      integration: lambdaIntegration,
      path: '/{proxy+}',
      methods: [HttpMethod.GET, HttpMethod.HEAD],
    });

    return apiGateway;
  }

  /**
   * Creates the CloudFront distribution behavior origin to route incoming requests to the Nuxt render Lambda function (via API gateway).
   */
  private createHttpOrigin(props: NuxtProps): HttpOrigin {
    return new HttpOrigin(`${this.apiGateway.httpApiId}.execute-api.${props.env.region}.amazonaws.com`, {
      originId: `${this.resourceIdPrefix}-httporigin`,
      connectionAttempts: 2,
      connectionTimeout: Duration.seconds(2),
      readTimeout: Duration.seconds(10),
      protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
    });
  }

  /**
   * Creates a scheduled rule to ping Lambda function every 5 minutes in order to keep it warm
   * and speed up initial SSR requests.
   *
   * @private
   */
  private createPingRule(props: NuxtProps): void {
    const fakeApiGatewayEventData = {
        "version": "2.0",
        "routeKey": "GET /{proxy+}",
        "rawPath": "/",
        "rawQueryString": "",
        "headers": {},
        "requestContext": {
            "http": {
                "method": "GET",
                "path": "/",
                "protocol": "HTTP/1.1"
            }
        }
    };

    new Rule(this, `PingRule`, {
        ruleName: `${this.resourceIdPrefix}-pinger`,
        description: `Pings the Lambda function of the ${this.resourceIdPrefix} app every 5 minutes to keep it warm.`,
        enabled: true,
        schedule: Schedule.rate(Duration.minutes(5)),
        targets: [new LambdaFunction(this.lambdaFunction, {
            event: RuleTargetInput.fromObject(fakeApiGatewayEventData)
        })],
    });
  }
}
