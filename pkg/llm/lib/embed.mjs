// control net
// embedding models: https://huggingface.co/sentence-transformers 

import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers"; 
import { env } from '@xenova/transformers';

env.allowRemoteModels = true; // disable after first test & cached
env.localModelPath = 'models';
env.cacheDir = 'Model';

const state = {
  init: false,
  modelDir: env.cacheDir,
  modelName: "Xenova/all-MiniLM-L12-v2",
  allowRemoteModels: false
}

export async function setup(opt = { }) {
  env.allowremoteModels = opt.allowRemoteModels ?? state.allowRemoteModels;
  env.localModelPath = opt.modelDir ?? state.modelDir;
  env.cacheDir = env.localModelPath;
  state.modelName = opt.modelName ?? state.modelName;
  state.model = new HuggingFaceTransformersEmbeddings({ modelName: state.modelName });
  state.init = true;
}

export async function vectorize(docs, opt = {}) {
  if (!state.init) {
    await setup();
  }

  const res = await state.model.embedDocuments(Array.isArray(docs) ? docs : [docs]);
  
  if (opt.debug) {
    console.log({ env, model: state.model, res });
  }

  return res;
}
