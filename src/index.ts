import { getSimplePaths } from "@xstate/graph";
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

export const xstateToGherkin = (
  machine: AnyMachine
): Array<Array<GherkinStep>> => {
  const canonicalDefn = machine.definition;
  const flattened = flattenConds(canonicalDefn);
  const pathsByEndState = getSimplePaths(
    createMachine({ predictableActionArguments: true, ...flattened })
  );
  return Object.keys(pathsByEndState)
    .flatMap((endState) => {
      const { state, paths } = pathsByEndState[endState];
      return paths.map((path) =>
        path.segments.flatMap((segment, idx) => {
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
        })
      );
    })
    .filter((steps) => steps.length > 0);
};

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
