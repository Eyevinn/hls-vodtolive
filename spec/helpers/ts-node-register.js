// Enables the existing jasmine runner to load the TypeScript spec files. This
// is a helper for jasmine (loaded before the specs via the `helpers` glob in
// spec/support/jasmine.json), not a new test framework — the runner is still
// jasmine. ts-node registers a require() hook for `.ts` so the `*[sS]pec.ts`
// files compile on the fly. The specs bind the library through
//   const HLSVod = require("../dist/index.js") as typeof import("../dist/index");
// a type-only annotation that consumes the typed public API (dist/*.d.ts) — so
// `new HLSVod(...)` is typed in an editor / under an explicit `tsc` — without
// turning the file into an ES module.
//
// Two deliberate choices keep this a mechanical 1:1 port of the previous
// JavaScript suite rather than a rewrite of the test logic:
//
//  * The specs stay *scripts* (no top-level import/export). The legacy suite
//    relied on sloppy-mode implicit globals (e.g. `mockVod = ...`, assigned
//    without `var`). ES modules are always strict, which would turn every such
//    assignment into a ReferenceError; keeping the files as scripts preserves
//    the exact previous runtime behaviour.
//  * transpileOnly: true. The legacy call-sites use looser arity and types than
//    the freshly-typed signatures (from the #143 source conversion) declare.
//    Enforcing nominal type-checking at run time would force either rewriting
//    the test logic (changing call-sites/behaviour) or loosening the public API
//    types — both out of scope for a spec migration. Transpiling without
//    type-checking runs the ported suite on the TypeScript sources while
//    keeping behaviour and coverage identical.
const path = require("path");

require("ts-node").register({
  project: path.join(__dirname, "..", "..", "tsconfig.json"),
  transpileOnly: true,
});
