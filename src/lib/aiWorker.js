// Runs the AI models off the page, so the page stays responsive while a model
// works. Vite bundles this worker on its own, with onnxruntime-web inside it.
//
// Messages in:  { id, type: "load", name, bytes }
//               { id, type: "run", name, input: Float32Array, dims }
// Messages out: { id } after a load, { id, data, dims } after a run,
//               or { id, error } when something failed
import * as ortWasm from "onnxruntime-web/wasm";
import wasmRuntime from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url";
import wasmBinary from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import jsepRuntime from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url";
import jsepBinary from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url";

const WASM_PATHS = { mjs: wasmRuntime, wasm: wasmBinary };
const JSEP_PATHS = { mjs: jsepRuntime, wasm: jsepBinary };

const sessions = {};

async function createSession(bytes, preferWebGpu) {
  if (preferWebGpu && self.navigator?.gpu) {
    try {
      const ort = await import("onnxruntime-web/webgpu");
      ort.env.wasm.wasmPaths = JSEP_PATHS;
      const session = await ort.InferenceSession.create(bytes, {
        executionProviders: ["webgpu", "wasm"],
      });
      return { session, ort, bytes, backend: "webgpu" };
    } catch {
      // Older browsers, missing GPU drivers, and unsupported ops use WASM.
    }
  }
  ortWasm.env.wasm.wasmPaths = WASM_PATHS;
  const session = await ortWasm.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
  return { session, ort: ortWasm, bytes, backend: "wasm" };
}

async function runSession(state, input, dims) {
  const tensor = new state.ort.Tensor("float32", input, dims);
  const output = await state.session.run({ [state.session.inputNames[0]]: tensor });
  return output[state.session.outputNames[0]];
}

self.onmessage = async ({ data: m }) => {
  try {
    if (m.type === "load") {
      sessions[m.name] ??= await createSession(m.bytes, m.name === "upscale");
      self.postMessage({ id: m.id, backend: sessions[m.name].backend });
      return;
    }
    let state = sessions[m.name];
    if (!state) throw new Error("The AI model hasn't been loaded.");
    let tensor;
    try {
      tensor = await runSession(state, m.input, m.dims);
    } catch (error) {
      if (state.backend !== "webgpu") throw error;
      state = await createSession(state.bytes, false);
      sessions[m.name] = state;
      tensor = await runSession(state, m.input, m.dims);
    }
    self.postMessage(
      { id: m.id, data: tensor.data, dims: tensor.dims, backend: state.backend },
      [tensor.data.buffer]
    );
  } catch (e) {
    self.postMessage({ id: m.id, error: String(e?.message ?? e) });
  }
};
