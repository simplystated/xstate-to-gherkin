# xstate-to-gherkin &middot; [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/simplystated/xstate-to-gherkin/blob/main/LICENSE) [![npm version](https://img.shields.io/npm/v/@simplystated/xstate-to-gherkin.svg?style=flat)](https://www.npmjs.com/package/@simplystated/xstate-to-gherkin) [![CI](https://github.com/simplystated/xstate-to-gherkin/actions/workflows/ci.yaml/badge.svg)](https://github.com/simplystated/xstate-to-gherkin/actions/workflows/ci.yaml)

xstate-to-gherkin is a library and cli tool to generate [Gherkin](https://cucumber.io/docs/gherkin/reference) test scripts from an [xstate](https://github.com/statelyai/xstate) statechart.

# Quickstart

You'll need to have an xstate [machine definition](https://xstate.js.org/docs/guides/machines.html).
xstate-to-gherkin requires you to annotate your machine with a few additional pieces of metadata.
On any state you would like to make an assertion for, set `meta.gherkinAssert` to a string describing what should be true in that state.
Optionally, on any state that is part of a feature, set `meta.gherkinFeature` to a string describing that feature.
Optionally, on any state that is part of a scenario, set `meta.gherkinScenario` to a string describing that scenario.

Here's an example.

Assume you have a `machine.ts` file like this:

```typescript
const basicWithConditions = createMachine({
  predictableActionArguments: true,
  id: "basicWithConditions",
  initial: "start",
  states: {
    start: {
      meta: {
        // whenever you're in this state, this should be true
        gherkinAssert: "I can see the start page",
        // this state is part of My Feature.
        gherkinFeature: "My Feature",
      },
      on: {
        "I tap the next button": [
          {
            target: "success",
            // guards will be turned into "When ... with <guard>."
            // So this will be turned into "When I tap on the next button with good input"
            cond: "good input",
          },
          {
            target: "failure",
            cond: "bad input",
          },
        ],
      },
    },
    success: {
      meta: {
        gherkinAssert: "I can see the success page",
        gherkinScenario: "Success",
      },
      initial: "successStep1",
      states: {
        successStep1: {
          meta: {
            gherkinAssert: "I see the first step of the success page",
          },
        },
      },
    },
    failure: {
      meta: {
        gherkinAssert: "I see the failure page",
        gherkinScenario: "Failure",
      },
    },
  },
});
```

After running

```bash
npx @simplystated/xstate-to-gherkin --output-dir out machine.ts
```

You should see a new file, `out/my-feature.feature` with contents like this:

```gherkin
Feature: My Feature

  Scenario: Success
    Given I can see the start page
    When I tap the next button with good input
    Then I can see the success page
    And I see the first step of the success page

  Scenario: Failure
    Given I can see the start page
    When I tap the next button with bad input
    Then I see the failure page
```

# Using xstate-to-gherkin as a library

Install:

```bash
npm install --save-dev @simplystated/xstate-to-gherkin
```

Then, in code:

```typescript
import { xstateToGherkinScripts } from "@simplystated/xstate-to-gherkin";
import { createMachine } from "xstate";

const machine = createMachine(...);

// scriptsByFilenames will contain a Map from filenames (e.g. my-feature.feature) to the Gherkin content of the file.
const scriptsByFilenames = xstateToGherkinScripts(machine);
```

# Why would you want to generate a Gherkin script from a statechart?

First off, it's important to note that you can describe any reactive system as a statechart.
That means that you can certainly model anything you are trying to test with Gherkin as a statechart.
Generally, modeling these types of systems as statecharts is quite straightforward because the structure of the statechart closely matches the way we humans tend to think about these systems.

Next, realize that you need to write a number of test scripts proportional to the number of paths through your system (statechart) if you want to cover all of your functionality.
Users do not just experience states; they experience paths through states.
Suffice it to say that there are many more paths than there are states.
If you try to explicitly list every path, you will have an enormous amount of work to do, especially if you add new edges near your initial state.

So, we can take advantage of the power of the declarative nature of statecharts AND the fact that they are easy to use to model any system we might care about AND the fact that they allow us to do work in proportion to the number of states instead of the number of paths to let our computer do the hard work for us.

# Simply Stated

xstate-to-gherkin is a small tool built by [Simply Stated](https://www.simplystated.dev).
At Simply Stated, our goal is to build all of the tooling you need to experience the full power of statecharts.

# License

xstate-to-gherkin is [MIT licensed](https://github.com/simplystated/xstate-to-gherkin/blob/main/LICENSE).
