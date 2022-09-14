# AWS CodeDeploy Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

## Table of Contents

- [Introduction](#introduction)
- Deploying to Amazon EC2 and on-premise instances
  - [EC2/on-premise Applications](#ec2on-premise-applications)
  - [EC2/on-premise Deployment Groups](#ec2on-premise-deployment-groups)
  - [EC2/on-premise Deployment Configurations](#ec2on-premise-deployment-configurations)
- Deploying to AWS Lambda functions
  - [Lambda Applications](#lambda-applications)
  - [Lambda Deployment Groups](#lambda-deployment-groups)
  - [Lambda Deployment Configurations](#lambda-deployment-configurations)
- Deploying to Amazon ECS services
  - [ECS Applications](#ecs-applications)
  - [ECS Deployment Groups](#ecs-deployment-groups)
  - [ECS Deployment Configurations](#ecs-deployment-configurations)

## Introduction

AWS CodeDeploy is a deployment service that automates application deployments to
Amazon EC2 instances, on-premises instances, serverless Lambda functions, or
Amazon ECS services.

The CDK currently supports Amazon EC2, on-premise, AWS Lambda, and Amazon ECS applications.

## EC2/on-premise Applications

To create a new CodeDeploy Application that deploys to EC2/on-premise instances:

```ts
const application = new codedeploy.ServerApplication(this, 'CodeDeployApplication', {
  applicationName: 'MyApplication', // optional property
});
```

To import an already existing Application:

```ts
const application = codedeploy.ServerApplication.fromServerApplicationName(
  this,
  'ExistingCodeDeployApplication',
  'MyExistingApplication',
);
```

## EC2/on-premise Deployment Groups

To create a new CodeDeploy Deployment Group that deploys to EC2/on-premise instances:

```ts
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';

declare const application: codedeploy.ServerApplication;
declare const asg: autoscaling.AutoScalingGroup;
declare const alarm: cloudwatch.Alarm;
const deploymentGroup = new codedeploy.ServerDeploymentGroup(this, 'CodeDeployDeploymentGroup', {
  application,
  deploymentGroupName: 'MyDeploymentGroup',
  autoScalingGroups: [asg],
  // adds User Data that installs the CodeDeploy agent on your auto-scaling groups hosts
  // default: true
  installAgent: true,
  // adds EC2 instances matching tags
  ec2InstanceTags: new codedeploy.InstanceTagSet(
    {
      // any instance with tags satisfying
      // key1=v1 or key1=v2 or key2 (any value) or value v3 (any key)
      // will match this group
      'key1': ['v1', 'v2'],
      'key2': [],
      '': ['v3'],
    },
  ),
  // adds on-premise instances matching tags
  onPremiseInstanceTags: new codedeploy.InstanceTagSet(
    // only instances with tags (key1=v1 or key1=v2) AND key2=v3 will match this set
    {
      'key1': ['v1', 'v2'],
    },
    {
      'key2': ['v3'],
    },
  ),
  // CloudWatch alarms
  alarms: [alarm],
  // whether to ignore failure to fetch the status of alarms from CloudWatch
  // default: false
  ignorePollAlarmsFailure: false,
  // auto-rollback configuration
  autoRollback: {
    failedDeployment: true, // default: true
    stoppedDeployment: true, // default: false
    deploymentInAlarm: true, // default: true if you provided any alarms, false otherwise
  },
});
```

All properties are optional - if you don't provide an Application,
one will be automatically created.

To import an already existing Deployment Group:

```ts
declare const application: codedeploy.ServerApplication;
const deploymentGroup = codedeploy.ServerDeploymentGroup.fromServerDeploymentGroupAttributes(
  this, 
  'ExistingCodeDeployDeploymentGroup', {
    application,
    deploymentGroupName: 'MyExistingDeploymentGroup',
  },
);
```

### Load balancers

You can [specify a load balancer](https://docs.aws.amazon.com/codedeploy/latest/userguide/integrations-aws-elastic-load-balancing.html)
with the `loadBalancer` property when creating a Deployment Group.

`LoadBalancer` is an abstract class with static factory methods that allow you to create instances of it from various sources.

With Classic Elastic Load Balancer, you provide it directly:

```ts
import * as elb from '@aws-cdk/aws-elasticloadbalancing';

declare const lb: elb.LoadBalancer;
lb.addListener({
  externalPort: 80,
});

const deploymentGroup = new codedeploy.ServerDeploymentGroup(this, 'DeploymentGroup', {
  loadBalancer: codedeploy.LoadBalancer.classic(lb),
});
```

With Application Load Balancer or Network Load Balancer,
you provide a Target Group as the load balancer:

```ts
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';

declare const alb: elbv2.ApplicationLoadBalancer;
const listener = alb.addListener('Listener', { port: 80 });
const targetGroup = listener.addTargets('Fleet', { port: 80 });

const deploymentGroup = new codedeploy.ServerDeploymentGroup(this, 'DeploymentGroup', {
  loadBalancer: codedeploy.LoadBalancer.application(targetGroup),
});
```

## EC2/on-premise Deployment Configurations

You can also pass a Deployment Configuration when creating the Deployment Group:

```ts
const deploymentGroup = new codedeploy.ServerDeploymentGroup(this, 'CodeDeployDeploymentGroup', {
  deploymentConfig: codedeploy.ServerDeploymentConfig.ALL_AT_ONCE,
});
```

The default Deployment Configuration is `ServerDeploymentConfig.ONE_AT_A_TIME`.

You can also create a custom Deployment Configuration:

```ts
const deploymentConfig = new codedeploy.ServerDeploymentConfig(this, 'DeploymentConfiguration', {
  deploymentConfigName: 'MyDeploymentConfiguration', // optional property
  // one of these is required, but both cannot be specified at the same time
  minimumHealthyHosts: codedeploy.MinimumHealthyHosts.count(2),
  // minimumHealthyHosts: codedeploy.MinimumHealthyHosts.percentage(75),
});
```

Or import an existing one:

```ts
const deploymentConfig = codedeploy.ServerDeploymentConfig.fromServerDeploymentConfigName(
  this,
  'ExistingDeploymentConfiguration',
  'MyExistingDeploymentConfiguration',
);
```

## Lambda Applications

To create a new CodeDeploy Application that deploys to a Lambda function:

```ts
const application = new codedeploy.LambdaApplication(this, 'CodeDeployApplication', {
  applicationName: 'MyApplication', // optional property
});
```

To import an already existing Application:

```ts
const application = codedeploy.LambdaApplication.fromLambdaApplicationName(
  this,
  'ExistingCodeDeployApplication',
  'MyExistingApplication',
);
```

## Lambda Deployment Groups

To enable traffic shifting deployments for Lambda functions, CodeDeploy uses Lambda Aliases, which can balance incoming traffic between two different versions of your function.
Before deployment, the alias sends 100% of invokes to the version used in production.
When you publish a new version of the function to your stack, CodeDeploy will send a small percentage of traffic to the new version, monitor, and validate before shifting 100% of traffic to the new version.

To create a new CodeDeploy Deployment Group that deploys to a Lambda function:

```ts
declare const myApplication: codedeploy.LambdaApplication;
declare const func: lambda.Function;
const version = func.currentVersion;
const version1Alias = new lambda.Alias(this, 'alias', {
  aliasName: 'prod',
  version,
});

const deploymentGroup = new codedeploy.LambdaDeploymentGroup(this, 'BlueGreenDeployment', {
  application: myApplication, // optional property: one will be created for you if not provided
  alias: version1Alias,
  deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
});
```

In order to deploy a new version of this function:

1. Reference the version with the latest changes `const version = func.currentVersion`.
2. Re-deploy the stack (this will trigger a deployment).
3. Monitor the CodeDeploy deployment as traffic shifts between the versions.

### Lambda Deployment Rollbacks and Alarms

CodeDeploy will roll back if the deployment fails. You can optionally trigger a rollback when one or more alarms are in a failed state:

```ts
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';

declare const alias: lambda.Alias;
const alarm = new cloudwatch.Alarm(this, 'Errors', {
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  threshold: 1,
  evaluationPeriods: 1,
  metric: alias.metricErrors(),
});
const deploymentGroup = new codedeploy.LambdaDeploymentGroup(this, 'BlueGreenDeployment', {
  alias,
  deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
  alarms: [
    // pass some alarms when constructing the deployment group
    alarm,
  ],
});

// or add alarms to an existing group
declare const blueGreenAlias: lambda.Alias;
deploymentGroup.addAlarm(new cloudwatch.Alarm(this, 'BlueGreenErrors', {
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  threshold: 1,
  evaluationPeriods: 1,
  metric: blueGreenAlias.metricErrors(),
}));
```

### Pre and Post Hooks

CodeDeploy allows you to run an arbitrary Lambda function before traffic shifting actually starts (PreTraffic Hook) and after it completes (PostTraffic Hook).
With either hook, you have the opportunity to run logic that determines whether the deployment must succeed or fail.
For example, with PreTraffic hook you could run integration tests against the newly created Lambda version (but not serving traffic). With PostTraffic hook, you could run end-to-end validation checks.

```ts
declare const warmUpUserCache: lambda.Function;
declare const endToEndValidation: lambda.Function;
declare const alias: lambda.Alias;

// pass a hook whe creating the deployment group
const deploymentGroup = new codedeploy.LambdaDeploymentGroup(this, 'BlueGreenDeployment', {
  alias: alias,
  deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
  preHook: warmUpUserCache,
});

// or configure one on an existing deployment group
deploymentGroup.addPostHook(endToEndValidation);
```

### Import an existing Lambda Deployment Group

To import an already existing Deployment Group:

```ts
declare const application: codedeploy.LambdaApplication;
const deploymentGroup = codedeploy.LambdaDeploymentGroup.fromLambdaDeploymentGroupAttributes(this, 'ExistingCodeDeployDeploymentGroup', {
  application,
  deploymentGroupName: 'MyExistingDeploymentGroup',
});
```

## Lambda Deployment Configurations

CodeDeploy for Lambda comes with built-in configurations for traffic shifting.
If you want to specify your own strategy,
you can do so with the LambdaDeploymentConfig construct,
letting you specify precisely how fast a new function version is deployed.

```ts
const config = new codedeploy.LambdaDeploymentConfig(this, 'CustomConfig', {
  type: codedeploy.LambdaDeploymentConfigType.CANARY,
  interval: Duration.minutes(1),
  percentage: 5,
});

declare const application: codedeploy.LambdaApplication;
declare const alias: lambda.Alias;
const deploymentGroup = new codedeploy.LambdaDeploymentGroup(this, 'BlueGreenDeployment', {
  application,
  alias,
  deploymentConfig: config,
});
```

You can specify a custom name for your deployment config, but if you do you will not be able to update the interval/percentage through CDK.

```ts
const config = new codedeploy.LambdaDeploymentConfig(this, 'CustomConfig', {
  type: codedeploy.LambdaDeploymentConfigType.CANARY,
  interval: Duration.minutes(1),
  percentage: 5,
  deploymentConfigName: 'MyDeploymentConfig',
});
```

To import an already existing Deployment Config:

```ts
const deploymentConfig = codedeploy.LambdaDeploymentConfig.fromLambdaDeploymentConfigName(
  this,
  'ExistingDeploymentConfiguration',
  'MyExistingDeploymentConfiguration',
);
```

## ECS Applications

To create a new CodeDeploy Application that deploys an ECS service:

```ts
const application = new codedeploy.EcsApplication(this, 'CodeDeployApplication', {
  applicationName: 'MyApplication', // optional property
});
```

To import an already existing Application:

```ts
const application = codedeploy.EcsApplication.fromEcsApplicationName(
  this,
  'ExistingCodeDeployApplication',
  'MyExistingApplication',
);
```

## ECS Deployment Groups

CodeDeploy can be used to deploy to load-balanced ECS services in a blue-green fashion.
CodeDeploy can slowly shift traffic from the load balancer over to the new version of the ECS service, as in canary deployments.

To create a CodeDeploy Deployment Group that deploys to an ECS service, you will need to use the ECS `CODE_DEPLOY` deployment controller when creating the ECS service:

```ts
const service = new ecs.FargateService(stack, 'FargateService', {
  cluster,
  taskDefinition,
  securityGroups: [securityGroup],
  deploymentController: {
    type: ecs.DeploymentControllerType.CODE_DEPLOY,
  },
});
```

You will also need to create a load balancer, two listeners, and two target groups for your load-balanced ECS service.
CodeDeploy will use these resources to orchestrate the blue-green deployment and traffic shifting.

```ts
const loadBalancer = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

// Listeners
const prodListener = loadBalancer.addListener('ProdListener', {
  port: 80, // port for production traffic
  protocol: elbv2.ApplicationProtocol.HTTP,
});
const testListener = loadBalancer.addListener('TestListener', {
  port: 9002, // port for testing
  protocol: elbv2.ApplicationProtocol.HTTP,
});

// Target groups
const blueTargetGroup = prodListener.addTargets('BlueTG', {
  port: 80,
  targets: [
    service.loadBalancerTarget({
      containerName: 'Container',
      containerPort: 80,
    }),
  ],
});
const greenTargetGroup = testListener.addTargets('GreenTG', {
  port: 80,
  targets: [
    service.loadBalancerTarget({
      containerName: 'Container',
      containerPort: 80,
    }),
  ],
});
```

You can then create a CodeDeploy deployment group that will perform a canary blue-green deployment to your ECS service.

```ts
new codedeploy.EcsDeploymentGroup(stack, 'BlueGreenDG', {
  services: [service],
  blueGreenDeploymentOptions: {
    blueTargetGroup,
    greenTargetGroup,
    prodTrafficRoute: prodListener,
    testTrafficRoute: testListener,
  },
  deploymentConfig: codedeploy.EcsDeploymentConfig.CANARY_10PERCENT_5MINUTES,
});
```

In order to deploy a new version of the ECS service, deploy the changes directly through CodeDeploy using the CodeDeploy APIs or console.
When the `CODE_DEPLOY` deployment controller is used, the ECS service cannot be updated through CloudFormation.

For more information on the behavior of CodeDeploy blue-green deployments for ECS, see
[What happens during an Amazon ECS deployment](https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-steps-ecs.html#deployment-steps-what-happens)
in the CodeDeploy user guide.

### ECS Deployment Rollbacks and Alarms

CodeDeploy will automatically roll back if a deployment fails.
You can optionally trigger an automatic rollback when one or more alarms are in a failed state during a deployment, or if the deployment stops.

```ts
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';

// Alarm on the number of unhealthy ECS tasks in each target group
const blueUnhealthyHosts = new cloudwatch.Alarm(stack, 'BlueUnhealthyHosts', {
  alarmName: stack.stackName + '-Unhealthy-Hosts-Blue',
  metric: blueTargetGroup.metricUnhealthyHostCount(),
  threshold: 1,
  evaluationPeriods: 2,
});

const greenUnhealthyHosts = new cloudwatch.Alarm(stack, 'GreenUnhealthyHosts', {
  alarmName: stack.stackName + '-Unhealthy-Hosts-Green',
  metric: greenTargetGroup.metricUnhealthyHostCount(),
  threshold: 1,
  evaluationPeriods: 2,
});

// Alarm on the number of HTTP 5xx responses returned by each target group
const blueApiFailure = new cloudwatch.Alarm(stack, 'Blue5xx', {
  alarmName: stack.stackName + '-Http-5xx-Blue',
  metric: blueTargetGroup.metricHttpCodeTarget(
    elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
    { period: cdk.Duration.minutes(1) },
  ),
  threshold: 1,
  evaluationPeriods: 1,
});

const greenApiFailure = new cloudwatch.Alarm(stack, 'Green5xx', {
  alarmName: stack.stackName + '-Http-5xx-Green',
  metric: greenTargetGroup.metricHttpCodeTarget(
    elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
    { period: cdk.Duration.minutes(1) },
  ),
  threshold: 1,
  evaluationPeriods: 1,
});

new codedeploy.EcsDeploymentGroup(stack, 'BlueGreenDG', {
  // CodeDeploy will monitor these alarms during a deployment and automatically roll back
  alarms: [blueUnhealthyHosts, greenUnhealthyHosts, blueApiFailure, greenApiFailure],
  autoRollback: {
    // CodeDeploy will automatically roll back if a deployment is stopped
    stoppedDeployment: true,
  },
  services: [service],
  blueGreenDeploymentOptions: {
    blueTargetGroup,
    greenTargetGroup,
    prodTrafficRoute: prodListener,
    testTrafficRoute: testListener,
  },
  deploymentConfig: codedeploy.EcsDeploymentConfig.CANARY_10PERCENT_5MINUTES,
});
```

### Manual deployment approval

After provisioning the 'green' ECS task set and re-routing test traffic during a blue-green deployment,
CodeDeploy can wait for approval before continuing the deployment and re-routing production traffic.
During this approval wait time, you can complete validation steps such as manual testing through the test
listener port, prior to exposing the new 'green' task set to production traffic.

To approve the deployment, validation steps use the CodeDeploy
[ContinueDeployment API(https://docs.aws.amazon.com/codedeploy/latest/APIReference/API_ContinueDeployment.html).
If the ContinueDeployment API is not called within the approval wait time period, CodeDeploy will stop the
deployment and can automatically roll back the deployment.

```ts
new codedeploy.EcsDeploymentGroup(stack, 'BlueGreenDG', {
  // The deployment will wait for approval for up to 8 hours before stopping the deployment
  deploymentApprovalWaitTime: Duration.hours(8),
  autoRollback: {
    // CodeDeploy will automatically roll back if the 8-hour approval period times out and the deployment stops
    stoppedDeployment: true,
  },
  services: [service],
  blueGreenDeploymentOptions: {
    blueTargetGroup,
    greenTargetGroup,
    prodTrafficRoute: prodListener,
    testTrafficRoute: testListener,
  },
  deploymentConfig: codedeploy.EcsDeploymentConfig.CANARY_10PERCENT_5MINUTES,
});
```

### Deployment bake time

You can specify how long CodeDeploy waits before it terminates the original 'blue' ECS task set when a blue-green deployment
is complete in order to let the deployment "bake" a while. During this bake time, CodeDeploy will continue to monitor any
CloudWatch alarms specified for the deployment group and will automatically roll back if those alarms go into a failed state.

```ts
new codedeploy.EcsDeploymentGroup(stack, 'BlueGreenDG', {
  services: [service],
  blueGreenDeploymentOptions: {
    blueTargetGroup,
    greenTargetGroup,
    prodTrafficRoute: prodListener,
    testTrafficRoute: testListener,
    // CodeDeploy will wait for 30 minutes after completing the blue-green deployment before it terminates the blue tasks
    terminationWaitTime: Duration.minutes(30),
  },
  // CodeDeploy will continue to monitor these alarms during the 30-minute bake time and will automatically
  // roll back if they go into a failed state at any point during the deployment.
  alarms: [blueUnhealthyHosts, greenUnhealthyHosts, blueApiFailure, greenApiFailure],
  deploymentConfig: codedeploy.EcsDeploymentConfig.CANARY_10PERCENT_5MINUTES,
});
```

### Import an existing ECS Deployment Group

To import an already existing Deployment Group:

```ts
declare const application: codedeploy.EcsApplication;
const deploymentGroup = codedeploy.EcsDeploymentGroup.fromEcsDeploymentGroupAttributes(this, 'ExistingCodeDeployDeploymentGroup', {
  application,
  deploymentGroupName: 'MyExistingDeploymentGroup',
});
```

## ECS Deployment Configurations

CodeDeploy for ECS comes with built-in configurations for traffic shifting.
If you want to specify your own strategy,
you can do so with the EcsDeploymentConfig construct,
letting you specify precisely how fast an ECS service is deployed.

```ts
new codedeploy.EcsDeploymentConfig(this, 'CustomConfig', {
  type: codedeploy.EcsDeploymentConfigType.CANARY,
  interval: Duration.minutes(1),
  percentage: 5,
});
```

You can specify a custom name for your deployment config, but if you do you will not be able to update the interval/percentage through CDK.

```ts
const config = new codedeploy.EcsDeploymentConfig(this, 'CustomConfig', {
  type: codedeploy.EcsDeploymentConfigType.CANARY,
  interval: Duration.minutes(1),
  percentage: 5,
  deploymentConfigName: 'MyDeploymentConfig',
});
```

Or import an existing one:

```ts
const deploymentConfig = codedeploy.EcsDeploymentConfig.fromEcsDeploymentConfigName(
  this,
  'ExistingDeploymentConfiguration',
  'MyExistingDeploymentConfiguration',
);
```
