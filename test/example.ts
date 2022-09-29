import { createMachine } from "xstate";
import {
  AstBuilder,
  GherkinClassicTokenMatcher,
  Parser,
} from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";
import { toGherkinScripts, xstateToGherkin } from "../src";

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

const basicWithTransientTransitions = createMachine({
  predictableActionArguments: true,
  id: "basicWithTransientTransitions",
  initial: "start",
  states: {
    start: {
      meta: {
        gherkinAssert: "I can see the start page",
        gherkinFeature: "My Feature",
      },
      always: [
        { target: "success", cond: "good input" },
        { target: "failure", cond: "bad input" },
      ],
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

  it("works for a basic example with transient transitions", () => {
    expect(xstateToGherkin(basicWithTransientTransitions)).toMatchSnapshot();
  });
});

describe("xstate to gherkin script", () => {
  it("works for a basic example with conditions", () => {
    const scripts = toGherkinScripts(xstateToGherkin(basicWithConditions));

    const parser = gherkinParser();
    scripts.forEach((script) => {
      expect(parser.parse(script).feature?.name).toEqual("My Feature");
    });

    expect(scripts).toMatchSnapshot();
  });
});

const gherkinParser = () => {
  const uuidFn = IdGenerator.uuid();
  const builder = new AstBuilder(uuidFn);
  const matcher = new GherkinClassicTokenMatcher();

  return new Parser(builder, matcher);
};
