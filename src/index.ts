import { getSimplePaths, StatePath } from "@xstate/graph";
import {
  AnyEventObject,
  createMachine,
  Segment,
  State,
  StateMachine,
  StateNode,
  StateNodeDefinition,
} from "xstate";

type AnyMachine = StateMachine<any, any, any>;
type AnyState = StateNodeDefinition<any, any, any>;

export const toGherkinScripts = (
  features: Array<GherkinFeature>
): Map<string, string> =>
  features.reduce((filenamesToScripts, gherkinFeature) => {
    const filename = toFilename(gherkinFeature.feature) + ".feature";
    const contents = featureToScript(gherkinFeature);
    filenamesToScripts.set(filename, contents);
    return filenamesToScripts;
  }, new Map());

export const xstateToGherkin = (machine: AnyMachine): Array<GherkinFeature> => {
  const canonicalDefn = machine.definition;
  const flattened = flattenConds(canonicalDefn);
  const pathsByEndState = getSimplePaths(
    createMachine({ predictableActionArguments: true, ...flattened })
  );
  const flattenedSteps = Object.keys(pathsByEndState)
    .flatMap((endState) => {
      const { state, paths } = pathsByEndState[endState];
      return paths.map((path) => {
        const features = path.segments.reduce((features, segment) => {
          gherkinFeaturesFromState(segment.state).forEach((gherkinFeature) =>
            features.add(gherkinFeature)
          );
          return features;
        }, new Set(gherkinFeaturesFromState(path.state)));
        const disambiguatingScenarios = Array.from(
          path.segments.reduce((scenarios, segment) => {
            gherkinScenariosFromState(segment.state).forEach(
              (gherkinScenario) => scenarios.add(gherkinScenario)
            );
            return scenarios;
          }, new Set<string>())
        );
        const scenario = gherkinScenariosFromState(path.state).join(" & ");
        const steps = path.segments.flatMap((segment, idx) => {
          const gherkinStepsForState = gherkinStepsFromState(
            segment.state,
            idx === 0
          );
          const gherkinStepsForEvent = gherkinStepsFromEvent(segment.event);
          return gherkinStepsForState
            .concat(gherkinStepsForEvent)
            .concat(
              gherkinStepsFromState(path.state, path.segments.length === 0)
            );
        });
        return {
          feature: Array.from(features).join(" & "),
          scenario,
          disambiguatingScenarios,
          steps,
        };
      });
    })
    .filter((feature) => feature.steps.length > 0);
  return flattenedStepsToScenarios(flattenedSteps);
};

const toFilename = (s: string): string =>
  s.toLowerCase().replace(/[^a-zA-Z0-9_]+/g, "-");

const featureToScript = (feature: GherkinFeature): string => {
  const script = `Feature: ${feature.feature}`;
  const featuresScript = feature.scenarios
    .map((scenario) => {
      const scenarioHeader = `Scenario: ${scenario.scenario}`;
      const steps = scenario.steps.map(
        (step) => `${step.keyword} ${step.step}`
      );
      return [indent(2, scenarioHeader)]
        .concat(steps.map(indent.bind(null, 4)))
        .join("\n");
    })
    .join("\n\n");
  return [script, featuresScript].join("\n\n");
};

const indent = (spaces: number, s: string): string =>
  new Array(spaces + 1).join(" ") + s;

const flattenedStepsToScenarios = (
  flattenedSteps: Array<GherkinStepsWithFeatureAndScenario>
): Array<GherkinFeature> => {
  const featuresByName = flattenedSteps.reduce(
    (
      featuresByName: Map<string, Map<string, Array<GherkinStep>>>,
      flattenedStep
    ) => {
      const { feature, scenario, steps, disambiguatingScenarios } =
        flattenedStep;
      const scenariosByName =
        featuresByName.get(feature) ?? new Map<string, Array<GherkinStep>>();
      const needDisambiguation = scenariosByName.has(scenario);
      const disambiguatedScenarioName = needDisambiguation
        ? `${[scenario].concat(disambiguatingScenarios).join(" with ")}`
        : scenario;
      const disambiguationFailed = scenariosByName.has(
        disambiguatedScenarioName
      );
      const finalScenarioName = disambiguationFailed
        ? `${disambiguatedScenarioName} ${scenariosByName.size}`
        : disambiguatedScenarioName;
      scenariosByName.set(finalScenarioName, steps);
      featuresByName.set(feature, scenariosByName);
      return featuresByName;
    },
    new Map()
  );
  return Array.from(featuresByName.entries()).map(
    ([feature, scenariosByName]) => ({
      feature,
      scenarios: Array.from(scenariosByName.entries()).map(
        ([scenario, steps]) => ({
          scenario,
          steps,
        })
      ),
    })
  );
};

interface GherkinStepsWithFeatureAndScenario {
  feature: string;
  scenario: string;
  disambiguatingScenarios: Array<string>;
  steps: Array<GherkinStep>;
}

export interface GherkinFeature {
  feature: string;
  scenarios: Array<GherkinScenario>;
}

export interface GherkinScenario {
  scenario: string;
  steps: Array<GherkinStep>;
}

export interface GherkinStep {
  keyword: "Given" | "Then" | "And" | "When";
  step: string;
}

const gherkinStepsFromEvent = (event: AnyEventObject): Array<GherkinStep> => [
  { keyword: "When", step: event.type.replace(/_/g, " ") },
];

const gherkinStepsFromState = (
  state: State<any, any>,
  isFirstStep: boolean
): Array<GherkinStep> =>
  valuesSortedByKey(state.meta)
    .map((m) => (m as any).gherkinAssert)
    .filter((gherkinAssert) => !!gherkinAssert)
    .map((step, idx) => {
      const keyword =
        idx === 0 && isFirstStep ? "Given" : idx === 0 ? "Then" : "And";
      return { keyword, step };
    });

const gherkinFeaturesFromState = (state: State<any, any>): Array<string> =>
  valuesSortedByKey(state.meta)
    .map((m) => (m as any).gherkinFeature)
    .filter((gherkinFeature) => !!gherkinFeature);

const gherkinScenariosFromState = (state: State<any, any>): Array<string> =>
  valuesSortedByKey(state.meta)
    .map((m) => (m as any).gherkinScenario)
    .filter((gherkinScenario) => !!gherkinScenario);

const valuesSortedByKey = <T>(m: Record<string, T>): Array<T> => {
  const keys = Object.keys(m);
  keys.sort();
  return keys.map((k) => m[k]);
};

const flattenConds = (state: AnyState): AnyState => {
  const { transitions, ...stateDefinition } = state;

  stateDefinition.on = Object.keys(stateDefinition.on).reduce((on, evtName) => {
    const evts = stateDefinition.on[evtName];
    return evts.reduce((on, evt) => {
      const { cond, ...unconditionalEvt } = evt;
      if (cond) {
        const condName = cond.name;
        const newEvtName = `${evtName} with ${condName}`;
        return {
          ...on,
          [newEvtName]: unconditionalEvt,
        };
      }

      return {
        ...on,
        [evtName]: evt,
      };
    }, on);
  }, {});

  stateDefinition.states = Object.keys(stateDefinition.states).reduce(
    (states, stateName) => ({
      ...states,
      [stateName]: flattenConds(stateDefinition.states[stateName]),
    }),
    {}
  );

  return new StateNode(stateDefinition).definition;
};
