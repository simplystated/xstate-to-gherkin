import * as meta from "@xstate/machine-extractor/src/"
import * as arg from "arg";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { createMachine } from "xstate";
import { parseMachinesFromFile } from "@xstate/machine-extractor";
import { toGherkinScripts, xstateToGherkin } from ".";
import * as path from "node:path";

export const run = (argv: Array<string>): number => {
  const args = arg(
    {
      "--help": Boolean,
      "--version": Boolean,
      "--output-dir": String,
      "--machine": String,
      "--force": Boolean,

      // aliases
      "-h": "--help",
      "-v": "--version",
      "-o": "--output-dir",
      "-m": "--machine",
      "-f": "--force",
    },
    {
        stopAtPositional: true,
        argv
    }
  );

  if ( args["--help"] ) {
    usage();
    return 0;
  }

  if ( args["--version"] ) {
    const packagejson = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
    console.log(`
        xstate-to-gherkin v${packagejson.version}
    `)
    return 0;
  }

  const outputDir = args["--output-dir"];
  const positionalArgs = args["_"]
  const selectedMachine = args["--machine"];
  const force = !!args["--force"];

  if ( !outputDir ) {
    console.error("--output-dir is required");
    usage();
    return 1;
  }

  if ( !positionalArgs || positionalArgs.length !== 1 ) {
    console.error("path to js/ts file is required (pass it after all other arguments)");
    usage();
    return 1;
  }

  return main(outputDir, positionalArgs[0], selectedMachine ?? null, force);
};

const usage = () => {
    console.log(`
        xstate-to-gherkin converts annotated xstate statecharts into gherkin test scripts.

        Usage:
          xstate-to-gherkin [--machine-name <name-of-machine-in-js-file>] [--force] --output-dir <directory-for-generated-gherkin-scripts> <path-to-js-file-containing-annotated-xstate-state-machine>

          Generates a set of .feature files in <directory-for-generated-gherkin-scripts> by traversing all simple paths in the statechart
          contained in <path-to-js-file-containing-annotated-xstate-state-machine>. If multiple machines are present in 
          <path-to-js-file-containing-annotated-xstate-state-machine>, specify --machine-name to pick one to use.
          By default, xstate-to-gherkin will not overwrite any files. Pass --force to overwrite.

        Statechart annotation:
          This tool requires each state to be annotated with up to 3 meta fields:
            gherkinFeature - (optional) specifies the feature this state is a part of
            gherkinScenario - (optional) specifies the scenario this state is a part of
            gherkinAssert - specifies the assertion that should hold in this state
    `);
}

const main = (outputDir: string, inputPath: string, selectedMachine: string | null, force: boolean): number => {
    const js = readFileSync(inputPath, "utf8");
    const machines = parseMachinesFromFile(js);
    const machineConfigs = machines.machines.map(m => m.toConfig());
    if ( machineConfigs.length > 1 && !selectedMachine) {
        console.error(`multiple machines found at ${inputPath}. specify --machine to select one.`);
        return 1;
    }
    const machineConfig = selectedMachine ? machineConfigs.filter(c => c?.id === selectedMachine)[0] : machineConfigs[0];
    if ( !machineConfig ) {
        if ( selectedMachine ) {
            console.error(`no machine named ${selectedMachine} found in ${inputPath}. found machines: [${machineConfigs.map(m => m?.id).join(", ")}].`)
        } else {
            console.error(`no machines found in ${inputPath}.`);
        }
        return 1;
    }

    const scriptsByName = toGherkinScripts(xstateToGherkin(createMachine({ ...machineConfig, predictableActionArguments: true })));
    for (const [filename, script] of scriptsByName.entries()) {
        const filePath = path.join(outputDir, filename);
        if ( !force && existsSync(filePath) ) {
            console.error(`refusing to overwrite existing file ${filePath}. pass --force to overwrite.`);
            return 1;
        }
        writeFileSync(path.join(outputDir, filename), script, { encoding: "utf8" });
    }

    return 0;
};
