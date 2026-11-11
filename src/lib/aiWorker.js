// Runs the AI models off the page, so the page stays responsive while a model
// works. Vite bundles this worker on its own, with onnxruntime-web inside it.
//
// Messages in:  { id, type: "load", name, bytes }
//               { id, type: "run", name, input: Float32Array, dims }
// Messages out: { id } after a load, { id, data, dims } after a run,
//               or { id, error } when something failed
import * as ort from "onnxruntime-web";

const sessions = {};

self.onmessage = async ({ data: m }) => {
  try {
    if (m.type === "load") {
      sessions[m.name] ??= await ort.InferenceSession.create(m.bytes, { executionProviders: ["wasm"] });
      self.postMessage({ id: m.id });
      return;
    }
    const session = sessions[m.name];
    if (!session) throw new Error("The AI model hasn't been loaded.");
    const output = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", m.input, m.dims) });
    const tensor = output[session.outputNames[0]];
    self.postMessage({ id: m.id, data: tensor.data, dims: tensor.dims }, [tensor.data.buffer]);
  } catch (e) {
    self.postMessage({ id: m.id, error: String(e?.message ?? e) });
  }
};
