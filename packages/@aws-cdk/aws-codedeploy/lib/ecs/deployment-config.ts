import { Duration, Names, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnDeploymentConfig } from '../codedeploy.generated';
import { arnForDeploymentConfig, validateName } from '../utils';

/**
 * The Deployment Configuration of an ECS Deployment Group.
 *
 * If you're managing the Deployment Configuration alongside the rest of your CDK resources,
 * use the {@link EcsDeploymentConfig} class.
 *
 * If you want to reference an already existing deployment configuration,
 * or one defined in a different CDK Stack,
 * use the {@link EcsDeploymentConfig#fromEcsDeploymentConfigName} method.
 *
 * The default, pre-defined Configurations are available as constants on the {@link EcsDeploymentConfig} class
 * (for example, `EcsDeploymentConfig.AllAtOnce`).
 */
export interface IEcsDeploymentConfig {
  /** @attribute */
  readonly deploymentConfigName: string;

  /** @attribute */
  readonly deploymentConfigArn: string;
}

/**
 * ECS Deployment config type
 */
export enum EcsDeploymentConfigType {
  /**
   * Canary deployment type
   */
  CANARY = 'Canary',

  /**
   * Linear deployment type
   */
  LINEAR = 'Linear'
}

/**
 * Construction properties of {@link EcsDeploymentConfig}.
 */
export interface EcsDeploymentConfigProps {

  /**
   * The type of deployment config, either CANARY or LINEAR
   */
  readonly type: EcsDeploymentConfigType;

  /**
   * The integer percentage of traffic to shift:
   * - For LINEAR, the percentage to shift every interval
   * - For CANARY, the percentage to shift until the interval passes, before the full deployment
   */
  readonly percentage: number;

  /**
   * The interval, in number of minutes:
   * - For LINEAR, how frequently additional traffic is shifted
   * - For CANARY, how long to shift traffic before the full deployment
   */
  readonly interval: Duration;

  /**
   * The verbatim name of the deployment config. Must be unique per account/region.
   * Other parameters cannot be updated if this name is provided.
   * @default - automatically generated name
   */
  readonly deploymentConfigName?: string;
}

/**
 * A custom Deployment Configuration for an ECS Deployment Group.
 *
 * @resource AWS::CodeDeploy::DeploymentConfig
 */
export class EcsDeploymentConfig extends Resource implements IEcsDeploymentConfig {
  public static readonly ALL_AT_ONCE = deploymentConfig('CodeDeployDefault.ECSAllAtOnce');
  public static readonly LINEAR_10PERCENT_EVERY_1MINUTE = deploymentConfig('CodeDeployDefault.ECSLinear10PercentEvery1Minutes');
  public static readonly LINEAR_10PERCENT_EVERY_3MINUTES = deploymentConfig('CodeDeployDefault.ECSLinear10PercentEvery3Minutes');
  public static readonly CANARY_10PERCENT_5MINUTES = deploymentConfig('CodeDeployDefault.ECSCanary10Percent5Minutes');
  public static readonly CANARY_10PERCENT_15MINUTES = deploymentConfig('CodeDeployDefault.ECSCanary10Percent15Minutes');

  /**
   * Import a custom Deployment Configuration for an ECS Deployment Group defined outside the CDK.
   *
   * @param scope the parent Construct for this new Construct
   * @param id the logical ID of this new Construct
   * @param ecsDeploymentConfigName the name of the referenced custom Deployment Configuration
   * @returns a Construct representing a reference to an existing custom Deployment Configuration
   */
  public static fromEcsDeploymentConfigName(scope: Construct, id: string, ecsDeploymentConfigName: string): IEcsDeploymentConfig {
    ignore(scope);
    ignore(id);
    return deploymentConfig(ecsDeploymentConfigName);
  }

  /**
   * The name of the deployment config
   * @attribute
   */
  public readonly deploymentConfigName: string;

  /**
     * The arn of the deployment config
     * @attribute
     */
  public readonly deploymentConfigArn: string;

  public constructor(scope: Construct, id: string, props: EcsDeploymentConfigProps) {
    super(scope, id);
    this.validateParameters(props);

    // Construct the traffic routing configuration for the deployment group
    const deploymentType = 'TimeBased' + props.type.toString();
    let routingConfig : CfnDeploymentConfig.TrafficRoutingConfigProperty;
    if (props.type == EcsDeploymentConfigType.CANARY) {
      routingConfig = {
        type: deploymentType,
        timeBasedCanary: {
          canaryInterval: props.interval.toMinutes(),
          canaryPercentage: props.percentage,
        },
      };
    } else { // EcsDeploymentConfigType.LINEAR
      routingConfig = {
        type: deploymentType,
        timeBasedLinear: {
          linearInterval: props.interval.toMinutes(),
          linearPercentage: props.percentage,
        },
      };
    }

    // Generates the name of the deployment config. It's also what you'll see in the AWS console
    // The name of the config is <construct unique id>.Ecs<deployment type><percentage>Percent<interval>Minutes
    // Unless the user provides an explicit name
    this.deploymentConfigName = props.deploymentConfigName
      ?? `${Names.uniqueId(this)}.ECS${props.type}${props.percentage}Percent${props.type === EcsDeploymentConfigType.LINEAR
        ? 'Every'
        : ''}${props.interval.toMinutes()}Minutes`;
    this.deploymentConfigArn = arnForDeploymentConfig(this.deploymentConfigName);

    new CfnDeploymentConfig(this, 'Resource', {
      deploymentConfigName: this.deploymentConfigName,
      computePlatform: 'ECS',
      trafficRoutingConfig: routingConfig,
    });

    this.node.addValidation({ validate: () => validateName('Deployment config', this.deploymentConfigName) });
  }

  // Validate the inputs. The percentage/interval limits come from CodeDeploy
  private validateParameters(props: EcsDeploymentConfigProps): void {
    if ( !(1 <= props.percentage && props.percentage <= 99) ) {
      throw new Error(
        `Invalid deployment config percentage "${props.percentage.toString()}". \
        Step percentage must be an integer between 1 and 99.`);
    }
    if (props.interval.toMinutes() > 2880) {
      throw new Error(
        `Invalid deployment config interval "${props.interval.toString()}". \
        Traffic shifting intervals must be positive integers up to 2880 (2 days).`);
    }
  }
}

function deploymentConfig(name: string): IEcsDeploymentConfig {
  return {
    deploymentConfigName: name,
    deploymentConfigArn: arnForDeploymentConfig(name),
  };
}

function ignore(_x: any) { return; }
