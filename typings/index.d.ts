// Project: https://github.com/codeception/codeceptjs/
/// <reference path="./types.d.ts" />
/// <reference types="webdriverio" />
/// <reference path="./Mocha.d.ts" />

declare namespace CodeceptJS {
  type WithTranslation<T> = T &
    import("./utils").Translate<T, Translation.Actions>;

  type Cookie = {
    name: string;
    value: string;
  };

  interface PageScrollPosition {
    x: number;
    y: number;
  }

  // Could get extended by user generated typings
  interface Methods extends ActorStatic {}
  interface I {}
  interface IHook {}
  interface IScenario {}
  interface IFeature {
    (title: string): FeatureConfig;
  }
  interface CallbackOrder extends Array<any> {}
  interface SupportObject {
    I: CodeceptJS.I;
  }
  namespace Translation {
    interface Actions {}
  }

  // Extending JSDoc generated typings
  interface Step {
    isMetaStep(): this is MetaStep;
  }

  // Types who are not be defined by JSDoc
  type actor = <T extends { [action: string]: (...args: any[]) => void }>(
    customSteps?: T & ThisType<WithTranslation<Methods & T>>
  ) => WithTranslation<Methods & T>;

  type ILocator =
    | { id: string }
    | { xpath: string }
    | { css: string }
    | { name: string }
    | { frame: string }
    | { android: string }
    | { ios: string }
    | { android: string; ios: string }
    | { react: string }
    | { shadow: string | string[] }
    | { custom: string };

  interface CustomLocators {}
  type LocatorOrString =
    | string
    | ILocator
    | Locator
    | CustomLocators[keyof CustomLocators];

  type StringOrSecret = string | CodeceptJS.Secret;

  interface HookCallback {
    (args: SupportObject): void;
  }
  interface Scenario extends IScenario {
    only: IScenario;
    skip: IScenario;
    todo: IScenario;
  }
  interface Feature extends IFeature {
    skip: IFeature;
  }
  interface IData {
    Scenario: IScenario;
    only: { Scenario: IScenario };
  }

  interface IScenario {
    // Scenario.todo can be called only with a title.
    (title: string, callback?: HookCallback): ScenarioConfig;
    (
      title: string,
      opts: { [key: string]: any },
      callback: HookCallback
    ): ScenarioConfig;
  }
  interface IHook {
    (callback: HookCallback): void;
  }

  interface Globals {
    codeceptjs: typeof codeceptjs;
  }
}

// Globals
declare const codecept_dir: string;
declare const output_dir: string;

declare const actor: CodeceptJS.actor;
declare const codecept_actor: CodeceptJS.actor;
declare const Helper: typeof CodeceptJS.Helper;
declare const codecept_helper: typeof CodeceptJS.Helper;
declare const pause: typeof CodeceptJS.pause;
declare const within: typeof CodeceptJS.within;
declare const session: typeof CodeceptJS.session;
declare const DataTable: typeof CodeceptJS.DataTable;
declare const codeceptjs: typeof CodeceptJS.index;
declare const locate: typeof CodeceptJS.Locator.build;
declare function inject(): CodeceptJS.SupportObject;
declare function inject<T extends keyof CodeceptJS.SupportObject>(
  name: T
): CodeceptJS.SupportObject[T];
declare const secret: typeof CodeceptJS.Secret.secret;

// BDD
declare const Given: typeof CodeceptJS.addStep;
declare const When: typeof CodeceptJS.addStep;
declare const Then: typeof CodeceptJS.addStep;

declare const Feature: typeof CodeceptJS.Feature;
declare const Scenario: CodeceptJS.Scenario;
declare const xScenario: CodeceptJS.IScenario;
declare const xFeature: CodeceptJS.IFeature;
declare function Data(data: any): CodeceptJS.IData;
declare function xData(data: any): CodeceptJS.IData;

// Hooks
declare const BeforeSuite: CodeceptJS.IHook;
declare const AfterSuite: CodeceptJS.IHook;
declare const Background: CodeceptJS.IHook;
declare const Before: CodeceptJS.IHook;
declare const After: CodeceptJS.IHook;

interface Window {
  codeceptjs: typeof CodeceptJS.browserCodecept;
  resq: any;
}

declare namespace NodeJS {
  interface Process {
    profile: string;
  }

  interface Global extends CodeceptJS.Globals {
    codecept_dir: typeof codecept_dir;
    output_dir: typeof output_dir;

    actor: typeof actor;
    codecept_actor: typeof codecept_actor;
    Helper: typeof Helper;
    codecept_helper: typeof codecept_helper;
    pause: typeof pause;
    within: typeof within;
    session: typeof session;
    DataTable: typeof DataTable;
    locate: typeof locate;
    inject: typeof inject;
    secret: typeof secret;

    // BDD
    Given: typeof Given;
    When: typeof When;
    Then: typeof Then;
  }
}

declare namespace Mocha {
  interface MochaGlobals {
    Feature: typeof Feature;
    Scenario: typeof Scenario;
    xFeature: typeof xFeature;
    xScenario: typeof xScenario;
    Data: typeof Data;
    xData: typeof xData;
    BeforeSuite: typeof BeforeSuite;
    AfterSuite: typeof AfterSuite;
    Background: typeof Background;
    Before: typeof Before;
    After: typeof After;
  }

  interface Suite extends SuiteRunnable {
    tags: any[];
    comment: string;
    feature: any;
  }

  interface Test extends Runnable {
    tags: any[];
  }
}

declare module "codeceptjs" {
  export = codeceptjs;
}
