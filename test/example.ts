import { createMachine } from "xstate";
import { xstateToGherkin } from "../src";

const basicWithConditions = createMachine({
  predictableActionArguments: true,
  id: "basicWithConditions",
  initial: "start",
  states: {
    start: {
      meta: {
        gherkinAssert: "I can see the start page",
        gherkinFeature: "My Feature",
      },
      on: {
        "I tap the next button": [
          {
            target: "success",
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

describe("xstate to gherkin", () => {
  it("works for a basic example with conditions", () => {
    expect(xstateToGherkin(basicWithConditions)).toMatchSnapshot();
  });
});
