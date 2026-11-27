/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS preload loaded via node --require */
/**
 * Test-only preload: lets Node scripts import service modules that start with `import "server-only"`.
 * That marker exists to stop server code being bundled for the BROWSER; a Node test process is server-side.
 * Usage: node --require ./scripts/test-env.cjs --import tsx scripts/e2e-exam-flow.ts
 */
const Module = require("node:module");
const path = require("node:path");
const empty = path.join(__dirname, "empty-module.cjs");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return empty;
  return original.call(this, request, ...rest);
};
