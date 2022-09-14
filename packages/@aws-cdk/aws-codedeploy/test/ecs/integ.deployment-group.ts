import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cdk from '@aws-cdk/core';
import * as integ from '@aws-cdk/integ-tests';
import * as codedeploy from '../../lib';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-cdk-codedeploy-ecs');

// Network infrastructure
const vpc = new ec2.Vpc(stack, 'VPC', { maxAzs: 2 });
const serviceSG = new ec2.SecurityGroup(stack, 'ServiceSecurityGroup', { vpc });

// ECS service
const cluster = new ecs.Cluster(stack, 'EcsCluster', {
  vpc,
});
const taskDefinition = new ecs.FargateTaskDefinition(stack, 'TaskDef');
taskDefinition.addContainer('Container', {
  image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
  portMappings: [{ containerPort: 80 }],
});
const service = new ecs.FargateService(stack, 'FargateService', {
  cluster,
  taskDefinition,
  securityGroups: [serviceSG],
  deploymentController: {
    type: ecs.DeploymentControllerType.CODE_DEPLOY,
  },
});

// Load balancer
const loadBalancer = new elbv2.ApplicationLoadBalancer(stack, 'ServiceLB', {
  vpc,
  internetFacing: false,
});
serviceSG.connections.allowFrom(loadBalancer, ec2.Port.tcp(80));

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
const blueTG = prodListener.addTargets('BlueTG', {
  port: 80,
  targets: [
    service.loadBalancerTarget({
      containerName: 'Container',
      containerPort: 80,
    }),
  ],
  deregistrationDelay: cdk.Duration.seconds(30),
  healthCheck: {
    interval: cdk.Duration.seconds(5),
    healthyHttpCodes: '200',
    healthyThresholdCount: 2,
    unhealthyThresholdCount: 3,
    timeout: cdk.Duration.seconds(4),
  },
});

const greenTG = testListener.addTargets('GreenTG', {
  port: 80,
  targets: [
    service.loadBalancerTarget({
      containerName: 'Container',
      containerPort: 80,
    }),
  ],
  deregistrationDelay: cdk.Duration.seconds(30),
  healthCheck: {
    interval: cdk.Duration.seconds(5),
    healthyHttpCodes: '200',
    healthyThresholdCount: 2,
    unhealthyThresholdCount: 3,
    timeout: cdk.Duration.seconds(4),
  },
});

// Alarms: monitor 500s and unhealthy hosts on target groups
const blueUnhealthyHosts = new cloudwatch.Alarm(stack, 'BlueUnhealthyHosts', {
  alarmName: stack.stackName + '-Unhealthy-Hosts-Blue',
  metric: blueTG.metricUnhealthyHostCount(),
  threshold: 1,
  evaluationPeriods: 2,
});

const blueApiFailure = new cloudwatch.Alarm(stack, 'Blue5xx', {
  alarmName: stack.stackName + '-Http-500-Blue',
  metric: blueTG.metricHttpCodeTarget(
    elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
    { period: cdk.Duration.minutes(1) },
  ),
  threshold: 1,
  evaluationPeriods: 1,
});

const greenUnhealthyHosts = new cloudwatch.Alarm(stack, 'GreenUnhealthyHosts', {
  alarmName: stack.stackName + '-Unhealthy-Hosts-Green',
  metric: greenTG.metricUnhealthyHostCount(),
  threshold: 1,
  evaluationPeriods: 2,
});

const greenApiFailure = new cloudwatch.Alarm(stack, 'Green5xx', {
  alarmName: stack.stackName + '-Http-500-Green',
  metric: greenTG.metricHttpCodeTarget(
    elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
    { period: cdk.Duration.minutes(1) },
  ),
  threshold: 1,
  evaluationPeriods: 1,
});

// Deployment group
new codedeploy.EcsDeploymentGroup(stack, 'BlueGreenDG', {
  alarms: [
    blueUnhealthyHosts,
    blueApiFailure,
    greenUnhealthyHosts,
    greenApiFailure,
  ],
  services: [service],
  blueGreenDeploymentOptions: {
    blueTargetGroup: blueTG,
    greenTargetGroup: greenTG,
    prodTrafficRoute: prodListener,
    testTrafficRoute: testListener,
    terminationWaitTime: cdk.Duration.minutes(30),
  },
  deploymentConfig: codedeploy.EcsDeploymentConfig.CANARY_10PERCENT_5MINUTES,
  autoRollback: {
    stoppedDeployment: true,
  },
});

new integ.IntegTest(app, 'EcsDeploymentGroupTest', {
  testCases: [stack],
});

app.synth();
