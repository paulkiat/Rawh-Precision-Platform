// control net
// embedding models: https://huggingface.co/sentence-transformers 

import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers"; 
import { env } from '@xenova/transformers';

const state = {
  init: false,
  modelDir: "models",
  modelName: "Xenova/all-MiniLM-L12-v2",
  allowRemoteModels: true
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

  docs = Array.isArray(docs) ? docs : [docs];

  const res = await new Promise(resolve => {
      embed_docs(docs, resolve);
  });
  
  if (opt.debug) {
    console.log({ env, model: state.model, res });
  }

  return res;
}

// this construct allows us to divide up a task that would otherwise
// block the node event loop resulting in heartbeat network failures
async function embed_docs(docs, resolve, mark = Date.now(), index = 0, arr = []) {
  if (index >= docs.length) {
      resolve(arr);
  } else if (Date.now() - mark > 1000) {
      setTimeout(() => {
        // unblock node event loop every 1 second
        embed_docs(docs, resolve, undefined, index, arr);
      }, 0);
  } else {
      state.model.embedQuery(docs[index]).then(vec => {
        arr.push(vec);
        embed_docs(docs, resolve, mark, index + 1, arr);
      });
  }
}
