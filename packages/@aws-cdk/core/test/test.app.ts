import cxapi = require('@aws-cdk/cx-api');
import { Test } from 'nodeunit';
import { CfnResource, Construct, Stack, StackProps } from '../lib';
import { App, AppProps } from '../lib/app';

function withApp(props: AppProps, block: (app: App) => void): cxapi.CloudAssembly {
  const app = new App({
    runtimeInfo: false,
    stackTraces: false,
    ...props,
  });

  block(app);

  return app.synth();
}

function synth(context?: { [key: string]: any }): cxapi.CloudAssembly {
  return withApp({ context }, app => {
    const stack1 = new Stack(app, 'stack1', { env: { account: '12345', region: 'us-east-1' } });
    new CfnResource(stack1, 's1c1', { type: 'DummyResource', properties: { Prop1: 'Prop1' } });
    const r2 = new CfnResource(stack1, 's1c2', { type: 'DummyResource', properties: { Foo: 123 } });

    const stack2 = new Stack(app, 'stack2');
    new CfnResource(stack2, 's2c1', { type: 'DummyResource', properties: { Prog2: 'Prog2' } });
    const c1 = new MyConstruct(stack2, 's1c2');

    // add some metadata
    stack1.node.addMetadata('meta', 111);
    r2.node.addWarning('warning1');
    r2.node.addWarning('warning2');
    c1.node.addMetadata('meta', { key: 'value' });
    app.node.addMetadata('applevel', 123); // apps can also have metadata
  });
}

function synthStack(name: string, includeMetadata: boolean = false, context?: any): cxapi.CloudFormationStackArtifact {
  const response = synth(context);
  const stack = response.getStack(name);

  if (!includeMetadata) {
    delete (stack as any).metadata;
  }

  return stack;
}

export = {
  'synthesizes all stacks and returns synthesis result'(test: Test) {
    const response = synth();
    delete (response as any).dir;

    test.deepEqual(response.stacks.length, 2);

    const stack1 = response.stacks[0];
    test.deepEqual(stack1.name, 'stack1');
    test.deepEqual(stack1.environment.account, 12345);
    test.deepEqual(stack1.environment.region, 'us-east-1');
    test.deepEqual(stack1.environment.name, 'aws://12345/us-east-1');
    test.deepEqual(stack1.template, { Resources:
      { s1c1: { Type: 'DummyResource', Properties: { Prop1: 'Prop1' } },
        s1c2: { Type: 'DummyResource', Properties: { Foo: 123 } } } });
    test.deepEqual(stack1.manifest.metadata, {
      '/stack1': [{ type: 'meta', data: 111 }],
      '/stack1/s1c1': [{ type: 'aws:cdk:logicalId', data: 's1c1' }],
      '/stack1/s1c2':
        [{ type: 'aws:cdk:logicalId', data: 's1c2' },
        { type: 'aws:cdk:warning', data: 'warning1' },
        { type: 'aws:cdk:warning', data: 'warning2' }],
    });

    const stack2 = response.stacks[1];
    test.deepEqual(stack2.name, 'stack2');
    test.deepEqual(stack2.environment.name, 'aws://unknown-account/unknown-region');
    test.deepEqual(stack2.template, { Resources:
      { s2c1: { Type: 'DummyResource', Properties: { Prog2: 'Prog2' } },
        s1c2r1D1791C01: { Type: 'ResourceType1' },
        s1c2r25F685FFF: { Type: 'ResourceType2' } } });
    test.deepEqual(stack2.manifest.metadata, {
      '/stack2/s2c1': [{ type: 'aws:cdk:logicalId', data: 's2c1' }],
      '/stack2/s1c2': [{ type: 'meta', data: { key: 'value' } }],
      '/stack2/s1c2/r1':
        [{ type: 'aws:cdk:logicalId', data: 's1c2r1D1791C01' }],
      '/stack2/s1c2/r2':
        [{ type: 'aws:cdk:logicalId', data: 's1c2r25F685FFF' }],
    });

    test.done();
},

'context can be passed through CDK_CONTEXT'(test: Test) {
  process.env[cxapi.CONTEXT_ENV] = JSON.stringify({
    key1: 'val1',
    key2: 'val2'
  });
  const prog = new App();
  test.deepEqual(prog.node.tryGetContext('key1'), 'val1');
  test.deepEqual(prog.node.tryGetContext('key2'), 'val2');
  test.done();
},

'context passed through CDK_CONTEXT has precedence'(test: Test) {
  process.env[cxapi.CONTEXT_ENV] = JSON.stringify({
    key1: 'val1',
    key2: 'val2'
  });
  const prog = new App({
    context: {
      key1: 'val3',
      key2: 'val4'
    }
  });
  test.deepEqual(prog.node.tryGetContext('key1'), 'val1');
  test.deepEqual(prog.node.tryGetContext('key2'), 'val2');
  test.done();
},

'context from the command line can be used when creating the stack'(test: Test) {
  const output = synthStack('stack2', false, { ctx1: 'HELLO' });

  test.deepEqual(output.template, {
    Resources: {
      s2c1: {
        Type: "DummyResource",
        Properties: {
          Prog2: "Prog2"
        }
      },
      s1c2r1D1791C01: {
        Type: "ResourceType1"
      },
      s1c2r25F685FFF: {
        Type: "ResourceType2",
        Properties: {
          FromContext: "HELLO"
        }
      }
    }
  });
  test.done();
},

'setContext(k,v) can be used to set context programmatically'(test: Test) {
  const prog = new App({
    context: {
      foo: 'bar'
    }
  });
  test.deepEqual(prog.node.tryGetContext('foo'), 'bar');
  test.done();
},

'setContext(k,v) cannot be called after stacks have been added because stacks may use the context'(test: Test) {
  const prog = new App();
  new Stack(prog, 's1');
  test.throws(() => prog.node.setContext('foo', 'bar'));
  test.done();
},

'app.synth() performs validation first and if there are errors, it returns the errors'(test: Test) {

  class Child extends Construct {
    protected validate() {
      return [`Error from ${this.node.id}`];
    }
  }

  class Parent extends Stack {

  }

  const app = new App();

  const parent = new Parent(app, 'Parent');
  new Child(parent, 'C1');
  new Child(parent, 'C2');

  test.throws(() => app.synth(), /Validation failed with the following errors/);

  test.done();
},

'app.synthesizeStack(stack) will return a list of missing contextual information'(test: Test) {
  class MyStack extends Stack {
    constructor(scope: App, id: string, props?: StackProps) {
      super(scope, id, props);

      this.reportMissingContext({
        key: 'missing-context-key',
        provider: 'fake',
        props: {
          account: '12345689012',
          region: 'ab-north-1',
        },
      },
      );

      this.reportMissingContext({
        key: 'missing-context-key-2',
        provider: 'fake2',
        props: {
          foo: 'bar',
          account: '12345689012',
          region: 'ab-south-1',
        },
      },
      );
    }
  }

  const assembly = withApp({}, app => {
    new MyStack(app, 'MyStack');
  });

  test.deepEqual(assembly.manifest.missing, [
    {
      key: "missing-context-key",
      provider: 'fake',
      props: {
        account: '12345689012',
        region: 'ab-north-1',
      },
    },
    {
      key: "missing-context-key-2",
      provider: 'fake2',
      props: {
        account: '12345689012',
        region: 'ab-south-1',
        foo: 'bar',
      },
    }
  ]);

  test.done();
},

'runtime library versions disabled'(test: Test) {
  const context: any = {};
  context[cxapi.DISABLE_VERSION_REPORTING] = true;

  const assembly = withApp(context, app => {
    const stack = new Stack(app, 'stack1');
    new CfnResource(stack, 'MyResource', { type: 'Resource::Type' });
  });

  test.deepEqual(assembly.runtime, { libraries: {} });
  test.done();
},

'runtime library versions'(test: Test) {
  const response = withApp({ runtimeInfo: true }, app => {
    const stack = new Stack(app, 'stack1');
    new CfnResource(stack, 'MyResource', { type: 'Resource::Type' });
  });

  const libs = (response.runtime && response.runtime.libraries) || {};

  const version = require('../package.json').version;
  test.deepEqual(libs['@aws-cdk/core'], version);
  test.deepEqual(libs['@aws-cdk/cx-api'], version);
  test.deepEqual(libs['jsii-runtime'], `node.js/${process.version}`);
  test.done();
},

'jsii-runtime version loaded from JSII_AGENT'(test: Test) {
  process.env.JSII_AGENT = 'Java/1.2.3.4';

  const response = withApp({ runtimeInfo: true }, app => {
    const stack = new Stack(app, 'stack1');
    new CfnResource(stack, 'MyResource', { type: 'Resource::Type' });
  });

  const libs = (response.runtime && response.runtime.libraries) || {};
  test.deepEqual(libs['jsii-runtime'], `Java/1.2.3.4`);

  delete process.env.JSII_AGENT;
  test.done();
},

'version reporting includes only @aws-cdk, aws-cdk and jsii libraries'(test: Test) {
  const response = withApp({ runtimeInfo: true }, app => {
    const stack = new Stack(app, 'stack1');
    new CfnResource(stack, 'MyResource', { type: 'Resource::Type' });
  });

  const libs = (response.runtime && response.runtime.libraries) || {};

  const version = require('../package.json').version;
  test.deepEqual(libs, {
    '@aws-cdk/core': version,
    '@aws-cdk/cx-api': version,
    'jsii-runtime': `node.js/${process.version}`
  });

  test.done();
},

'deep stack is shown and synthesized properly'(test: Test) {
  // WHEN
  const response = withApp({}, (app) => {
    const topStack = new Stack(app, 'Stack');
    const topResource = new CfnResource(topStack, 'Res', { type: 'CDK::TopStack::Resource' });

    const bottomStack = new Stack(topResource, 'Stack');
    new CfnResource(bottomStack, 'Res', { type: 'CDK::BottomStack::Resource' });
  });

  // THEN
  test.deepEqual(response.stacks.map(s => ({ name: s.name, template: s.template })), [
    {
      name: 'Stack',
      template: { Resources: { Res: { Type: 'CDK::TopStack::Resource' } } },
    },
    {
      name: 'StackResStack7E4AFA86',
      template: { Resources: { Res: { Type: 'CDK::BottomStack::Resource' } } },
    },
  ]);

  test.done();
},
};

class MyConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new CfnResource(this, 'r1', { type: 'ResourceType1' });
    new CfnResource(this, 'r2', { type: 'ResourceType2', properties: { FromContext: this.node.tryGetContext('ctx1') } });
  }
}
