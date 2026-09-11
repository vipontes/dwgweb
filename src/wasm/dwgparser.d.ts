// Hand-written declaration for the Emscripten-generated dwgparser.js glue
// (built by wasm/build.sh from wasm/bindings.cpp + dwgviewer's
// dwg_document.cpp), co-located so TS picks it up automatically for
// `import './dwgparser.js'`. The embind-bound API's exact JS shape isn't
// asserted here -- parser.ts's `WasmModule`/`WasmVector`/`WasmValue`
// aliases treat it as `any` and encode the real per-field shape by hand,
// matching bindings.cpp field-for-field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function createDwgParserModule(moduleArg?: Record<string, unknown>): Promise<any>;
export default createDwgParserModule;
