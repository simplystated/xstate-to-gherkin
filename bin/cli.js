#!/usr/bin/env node

"use strict";

const cli = require("../dist/cli.js");

cli.run(process.argv.slice(2));