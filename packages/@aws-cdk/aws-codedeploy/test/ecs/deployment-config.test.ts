import { Template } from '@aws-cdk/assertions';
import * as cdk from '@aws-cdk/core';
import * as codedeploy from '../../lib';

/* eslint-disable quote-props */

let stack: cdk.Stack;

beforeEach(() => {
  stack = new cdk.Stack();
});

test('can create linear config', () => {
  // WHEN
  new codedeploy.EcsDeploymentConfig(stack, 'MyConfig', {
    type: codedeploy.EcsDeploymentConfigType.LINEAR,
    interval: cdk.Duration.minutes(1),
    percentage: 5,
  });

  // THEN
  Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentConfig', {
    'ComputePlatform': 'ECS',
    'DeploymentConfigName': 'MyConfig.ECSLinear5PercentEvery1Minutes',
    'TrafficRoutingConfig': {
      'TimeBasedLinear': {
        'LinearInterval': 1,
        'LinearPercentage': 5,
      },
      'Type': 'TimeBasedLinear',
    },
  });
});

test('can create canary config', () => {
  // WHEN
  new codedeploy.EcsDeploymentConfig(stack, 'MyConfig', {
    type: codedeploy.EcsDeploymentConfigType.CANARY,
    interval: cdk.Duration.minutes(1),
    percentage: 5,
  });

  // THEN
  Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentConfig', {
    'ComputePlatform': 'ECS',
    'DeploymentConfigName': 'MyConfig.ECSCanary5Percent1Minutes',
    'TrafficRoutingConfig': {
      'TimeBasedCanary': {
        'CanaryInterval': 1,
        'CanaryPercentage': 5,
      },
      'Type': 'TimeBasedCanary',
    },
  });
});

test('can create a config with a specific name', () => {
  // WHEN
  new codedeploy.EcsDeploymentConfig(stack, 'MyConfig', {
    deploymentConfigName: 'MyCanaryConfig',
    type: codedeploy.EcsDeploymentConfigType.CANARY,
    interval: cdk.Duration.minutes(1),
    percentage: 5,
  });

  // THEN
  Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentConfig', {
    'ComputePlatform': 'ECS',
    'DeploymentConfigName': 'MyCanaryConfig',
    'TrafficRoutingConfig': {
      'TimeBasedCanary': {
        'CanaryInterval': 1,
        'CanaryPercentage': 5,
      },
      'Type': 'TimeBasedCanary',
    },
  });
});

test('can be imported', () => {
  const deploymentConfig = codedeploy.EcsDeploymentConfig.fromEcsDeploymentConfigName(stack, 'MyDC', 'MyDC');

  expect(deploymentConfig).not.toEqual(undefined);
});

test('fail with more than 100 characters in name', () => {
  const app = new cdk.App();
  const stackWithApp = new cdk.Stack(app);
  new codedeploy.EcsDeploymentConfig(stackWithApp, 'MyConfig', {
    type: codedeploy.EcsDeploymentConfigType.CANARY,
    interval: cdk.Duration.minutes(1),
    percentage: 5,
    deploymentConfigName: 'a'.repeat(101),
  });

  expect(() => app.synth()).toThrow(`Deployment config name: "${'a'.repeat(101)}" can be a max of 100 characters.`);
});

test('fail with unallowed characters in name', () => {
  const app = new cdk.App();
  const stackWithApp = new cdk.Stack(app);
  new codedeploy.EcsDeploymentConfig(stackWithApp, 'MyConfig', {
    type: codedeploy.EcsDeploymentConfigType.CANARY,
    interval: cdk.Duration.minutes(1),
    percentage: 5,
    deploymentConfigName: 'my name',
  });

  expect(() => app.synth()).toThrow('Deployment config name: "my name" can only contain letters (a-z, A-Z), numbers (0-9), periods (.), underscores (_), + (plus signs), = (equals signs), , (commas), @ (at signs), - (minus signs).');
});
