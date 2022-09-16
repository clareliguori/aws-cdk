import { Template } from '@aws-cdk/assertions';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Duration } from '@aws-cdk/core';
import * as codedeploy from '../../lib';

const mockCluster = 'my-cluster';
const mockService = 'my-service';
const mockRegion = 'my-region';
const mockAccount = 'my-account';

function mockEcsService(stack: cdk.Stack): ecs.IBaseService {
  const serviceArn = `arn:aws:ecs:${mockRegion}:${mockAccount}:service/${mockCluster}/${mockService}`;
  return ecs.BaseService.fromServiceArnWithCluster(stack, 'Service', serviceArn);
}

function mockTargetGroup(stack: cdk.Stack, id: string): elbv2.ITargetGroup {
  const targetGroupArn = `arn:aws:elasticloadbalancing:${mockRegion}:${mockAccount}:targetgroup/${id}/f7a80aba5edd5980`;
  return elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(stack, id, {
    targetGroupArn,
  });
}

function mockListener(stack: cdk.Stack, id: string): elbv2.IListener {
  const listenerArn = `arn:aws:elasticloadbalancing:${mockRegion}:${mockAccount}:listener/app/myloadbalancer/lb-12345/${id}`;
  const securityGroup = ec2.SecurityGroup.fromSecurityGroupId(stack, 'MySecurityGroup' + id, 'sg-12345678');
  return elbv2.ApplicationListener.fromApplicationListenerAttributes(stack, 'Listener' + id, {
    listenerArn,
    securityGroup,
  });
}

describe('CodeDeploy ECS DeploymentGroup', () => {
  describe('imported with fromEcsDeploymentGroupAttributes', () => {
    test('defaults the Deployment Config to AllAtOnce', () => {
      const stack = new cdk.Stack();

      const ecsApp = codedeploy.EcsApplication.fromEcsApplicationName(stack, 'EA', 'EcsApplication');
      const importedGroup = codedeploy.EcsDeploymentGroup.fromEcsDeploymentGroupAttributes(stack, 'EDG', {
        application: ecsApp,
        deploymentGroupName: 'EcsDeploymentGroup',
      });

      expect(importedGroup.deploymentConfig).toEqual(codedeploy.EcsDeploymentConfig.ALL_AT_ONCE);
    });
  });

  test('can be created with default configuration', () => {
    const stack = new cdk.Stack();

    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    Template.fromStack(stack).hasResource('AWS::CodeDeploy::DeploymentGroup', {
      Type: 'AWS::CodeDeploy::DeploymentGroup',
      Properties: {
        ApplicationName: {
          Ref: 'MyDGApplication57B1E402',
        },
        ServiceRoleArn: {
          'Fn::GetAtt': [
            'MyDGServiceRole5E94FD88',
            'Arn',
          ],
        },
        AutoRollbackConfiguration: {
          Enabled: true,
          Events: [
            'DEPLOYMENT_FAILURE',
          ],
        },
        BlueGreenDeploymentConfiguration: {
          DeploymentReadyOption: {
            ActionOnTimeout: 'CONTINUE_DEPLOYMENT',
            WaitTimeInMinutes: 0,
          },
          TerminateBlueInstancesOnDeploymentSuccess: {
            Action: 'TERMINATE',
            TerminationWaitTimeInMinutes: 0,
          },
        },
        DeploymentConfigName: 'CodeDeployDefault.ECSAllAtOnce',
        DeploymentStyle: {
          DeploymentOption: 'WITH_TRAFFIC_CONTROL',
          DeploymentType: 'BLUE_GREEN',
        },
        ECSServices: [
          {
            ClusterName: 'my-cluster',
            ServiceName: 'my-service',
          },
        ],
        LoadBalancerInfo: {
          TargetGroupPairInfoList: [
            {
              ProdTrafficRoute: {
                ListenerArns: [
                  'arn:aws:elasticloadbalancing:my-region:my-account:listener/app/myloadbalancer/lb-12345/prod',
                ],
              },
              TargetGroups: [
                {
                  Name: 'blue',
                },
                {
                  Name: 'green',
                },
              ],
            },
          ],
        },
      },
    });

    Template.fromStack(stack).hasResource('AWS::CodeDeploy::Application', {
      Type: 'AWS::CodeDeploy::Application',
      Properties: {
        ComputePlatform: 'ECS',
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [{
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: {
              'Fn::FindInMap': [
                'ServiceprincipalMap',
                {
                  Ref: 'AWS::Region',
                },
                'codedeploy',
              ],
            },
          },
        }],
        Version: '2012-10-17',
      },
      ManagedPolicyArns: [
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              { Ref: 'AWS::Partition' },
              ':iam::aws:policy/AWSCodeDeployRoleForECSLimited',
            ],
          ],
        },
      ],
    });
  });

  test('can be created with explicit name', () => {
    const stack = new cdk.Stack();
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      deploymentGroupName: 'test',
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
      DeploymentGroupName: 'test',
    });
  });

  test('can be created with explicit application', () => {
    const stack = new cdk.Stack();
    const application = codedeploy.EcsApplication.fromEcsApplicationName(stack, 'A', 'myapp');
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      application,
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
      ApplicationName: 'myapp',
    });
  });

  test('can be created with explicit deployment config', () => {
    const stack = new cdk.Stack();
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      deploymentConfig: codedeploy.EcsDeploymentConfig.CANARY_10PERCENT_15MINUTES,
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
      DeploymentConfigName: 'CodeDeployDefault.ECSCanary10Percent15Minutes',
    });
  });

  test('fail with more than 100 characters in name', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app);
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      deploymentGroupName: 'a'.repeat(101),
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    expect(() => app.synth()).toThrow(`Deployment group name: "${'a'.repeat(101)}" can be a max of 100 characters.`);
  });

  test('fail with unallowed characters in name', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app);
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      deploymentGroupName: 'my name',
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    expect(() => app.synth()).toThrow('Deployment group name: "my name" can only contain letters (a-z, A-Z), numbers (0-9), periods (.), underscores (_), + (plus signs), = (equals signs), , (commas), @ (at signs), - (minus signs).');
  });

  test('can be created with explicit role', () => {
    const stack = new cdk.Stack();
    const serviceRole = new iam.Role(stack, 'MyRole', {
      assumedBy: new iam.ServicePrincipal('not-codedeploy.test'),
    });

    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      role: serviceRole,
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [{
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'not-codedeploy.test',
          },
        }],
        Version: '2012-10-17',
      },
      ManagedPolicyArns: [
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              { Ref: 'AWS::Partition' },
              ':iam::aws:policy/AWSCodeDeployRoleForECSLimited',
            ],
          ],
        },
      ],
    });
  });

  test('can rollback on alarm', () => {
    const stack = new cdk.Stack();
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      alarms: [
        new cloudwatch.Alarm(stack, 'BlueTGUnHealthyHosts', {
          metric: new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'UnHealthyHostCount',
            dimensionsMap: {
              TargetGroup: 'blue/f7a80aba5edd5980',
              LoadBalancer: 'app/myloadbalancer/lb-12345',
            },
          }),
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          threshold: 1,
          evaluationPeriods: 1,
        }),
        new cloudwatch.Alarm(stack, 'GreenTGUnHealthyHosts', {
          metric: new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'UnHealthyHostCount',
            dimensionsMap: {
              TargetGroup: 'green/f7a80aba5edd5980',
              LoadBalancer: 'app/myloadbalancer/lb-12345',
            },
          }),
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          threshold: 1,
          evaluationPeriods: 1,
        }),
      ],
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
      AlarmConfiguration: {
        Alarms: [
          {
            Name: {
              Ref: 'BlueTGUnHealthyHostsE5A415E0',
            },
          },
          {
            Name: {
              Ref: 'GreenTGUnHealthyHosts49873ED5',
            },
          },
        ],
        Enabled: true,
      },
      AutoRollbackConfiguration: {
        Enabled: true,
        Events: [
          'DEPLOYMENT_FAILURE',
          'DEPLOYMENT_STOP_ON_ALARM',
        ],
      },
    });
  });

  test('can disable rollback when alarm polling fails', () => {
    const stack = new cdk.Stack();
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      ignorePollAlarmsFailure: true,
      alarms: [
        new cloudwatch.Alarm(stack, 'BlueTGUnHealthyHosts', {
          metric: new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'UnHealthyHostCount',
            dimensionsMap: {
              TargetGroup: 'blue/f7a80aba5edd5980',
              LoadBalancer: 'app/myloadbalancer/lb-12345',
            },
          }),
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          threshold: 1,
          evaluationPeriods: 1,
        }),
        new cloudwatch.Alarm(stack, 'GreenTGUnHealthyHosts', {
          metric: new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'UnHealthyHostCount',
            dimensionsMap: {
              TargetGroup: 'green/f7a80aba5edd5980',
              LoadBalancer: 'app/myloadbalancer/lb-12345',
            },
          }),
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          threshold: 1,
          evaluationPeriods: 1,
        }),
      ],
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
      AlarmConfiguration: {
        Alarms: [
          {
            Name: {
              Ref: 'BlueTGUnHealthyHostsE5A415E0',
            },
          },
          {
            Name: {
              Ref: 'GreenTGUnHealthyHosts49873ED5',
            },
          },
        ],
        Enabled: true,
      },
      AutoRollbackConfiguration: {
        Enabled: true,
        Events: [
          'DEPLOYMENT_FAILURE',
          'DEPLOYMENT_STOP_ON_ALARM',
        ],
      },
    });
  });

  test('can disable rollback when deployment fails', () => {
    const stack = new cdk.Stack();
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      autoRollback: {
        failedDeployment: false,
      },
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    Template.fromStack(stack).hasResource('AWS::CodeDeploy::DeploymentGroup', {
      Type: 'AWS::CodeDeploy::DeploymentGroup',
      Properties: {
        ApplicationName: {
          Ref: 'MyDGApplication57B1E402',
        },
        ServiceRoleArn: {
          'Fn::GetAtt': [
            'MyDGServiceRole5E94FD88',
            'Arn',
          ],
        },
        BlueGreenDeploymentConfiguration: {
          DeploymentReadyOption: {
            ActionOnTimeout: 'CONTINUE_DEPLOYMENT',
            WaitTimeInMinutes: 0,
          },
          TerminateBlueInstancesOnDeploymentSuccess: {
            Action: 'TERMINATE',
            TerminationWaitTimeInMinutes: 0,
          },
        },
        DeploymentConfigName: 'CodeDeployDefault.ECSAllAtOnce',
        DeploymentStyle: {
          DeploymentOption: 'WITH_TRAFFIC_CONTROL',
          DeploymentType: 'BLUE_GREEN',
        },
        ECSServices: [
          {
            ClusterName: 'my-cluster',
            ServiceName: 'my-service',
          },
        ],
        LoadBalancerInfo: {
          TargetGroupPairInfoList: [
            {
              ProdTrafficRoute: {
                ListenerArns: [
                  'arn:aws:elasticloadbalancing:my-region:my-account:listener/app/myloadbalancer/lb-12345/prod',
                ],
              },
              TargetGroups: [
                {
                  Name: 'blue',
                },
                {
                  Name: 'green',
                },
              ],
            },
          ],
        },
      },
    });
  });

  test('can enable rollback when deployment stops', () => {
    const stack = new cdk.Stack();
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      autoRollback: {
        stoppedDeployment: true,
      },
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
      AutoRollbackConfiguration: {
        Enabled: true,
        Events: [
          'DEPLOYMENT_FAILURE',
          'DEPLOYMENT_STOP_ON_REQUEST',
        ],
      },
    });
  });

  test('can disable rollback when alarm in failure state', () => {
    const stack = new cdk.Stack();
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      autoRollback: {
        deploymentInAlarm: false,
      },
      alarms: [
        new cloudwatch.Alarm(stack, 'BlueTGUnHealthyHosts', {
          metric: new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'UnHealthyHostCount',
            dimensionsMap: {
              TargetGroup: 'blue/f7a80aba5edd5980',
              LoadBalancer: 'app/myloadbalancer/lb-12345',
            },
          }),
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          threshold: 1,
          evaluationPeriods: 1,
        }),
        new cloudwatch.Alarm(stack, 'GreenTGUnHealthyHosts', {
          metric: new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'UnHealthyHostCount',
            dimensionsMap: {
              TargetGroup: 'green/f7a80aba5edd5980',
              LoadBalancer: 'app/myloadbalancer/lb-12345',
            },
          }),
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          threshold: 1,
          evaluationPeriods: 1,
        }),
      ],
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
      AlarmConfiguration: {
        Alarms: [
          {
            Name: {
              Ref: 'BlueTGUnHealthyHostsE5A415E0',
            },
          },
          {
            Name: {
              Ref: 'GreenTGUnHealthyHosts49873ED5',
            },
          },
        ],
        Enabled: true,
      },
      AutoRollbackConfiguration: {
        Enabled: true,
        Events: [
          'DEPLOYMENT_FAILURE',
        ],
      },
    });
  });

  test('can specify a test traffic route', () => {
    const stack = new cdk.Stack();
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
        testTrafficRoute: mockListener(stack, 'test'),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
      LoadBalancerInfo: {
        TargetGroupPairInfoList: [
          {
            ProdTrafficRoute: {
              ListenerArns: [
                'arn:aws:elasticloadbalancing:my-region:my-account:listener/app/myloadbalancer/lb-12345/prod',
              ],
            },
            TestTrafficRoute: {
              ListenerArns: [
                'arn:aws:elasticloadbalancing:my-region:my-account:listener/app/myloadbalancer/lb-12345/test',
              ],
            },
            TargetGroups: [
              {
                Name: 'blue',
              },
              {
                Name: 'green',
              },
            ],
          },
        ],
      },
    });
  });

  test('can require manual deployment approval', () => {
    const stack = new cdk.Stack();
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
        deploymentApprovalWaitTime: Duration.hours(8),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
      BlueGreenDeploymentConfiguration: {
        DeploymentReadyOption: {
          ActionOnTimeout: 'STOP_DEPLOYMENT',
          WaitTimeInMinutes: 480,
        },
        TerminateBlueInstancesOnDeploymentSuccess: {
          Action: 'TERMINATE',
          TerminationWaitTimeInMinutes: 0,
        },
      },
    });
  });

  test('can add deployment bake time', () => {
    const stack = new cdk.Stack();
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
        terminationWaitTime: Duration.hours(1),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
      BlueGreenDeploymentConfiguration: {
        DeploymentReadyOption: {
          ActionOnTimeout: 'CONTINUE_DEPLOYMENT',
          WaitTimeInMinutes: 0,
        },
        TerminateBlueInstancesOnDeploymentSuccess: {
          Action: 'TERMINATE',
          TerminationWaitTimeInMinutes: 60,
        },
      },
    });
  });

  test('uses the correct Service Principal in the us-isob-east-1 region', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'CodeDeployLambdaStack', {
      env: { region: 'us-isob-east-1' },
    });
    new codedeploy.EcsDeploymentGroup(stack, 'MyDG', {
      services: [mockEcsService(stack)],
      blueGreenDeploymentOptions: {
        blueTargetGroup: mockTargetGroup(stack, 'blue'),
        greenTargetGroup: mockTargetGroup(stack, 'green'),
        prodTrafficRoute: mockListener(stack, 'prod'),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'codedeploy.amazonaws.com',
            },
          },
        ],
        Version: '2012-10-17',
      },
    });
  });
});
