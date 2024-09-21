// control net
// embedding models: https://huggingface.co/sentence-transformers 
// more accurate: Xenova/all-mpnet-base-v2 (768 dimensions)
// faster: Xenova/all-miniLM-L6-v2 (384 dimensions)

import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers"; 
import { env } from '@xenova/transformers';

const state = {
  init: false,
  modelDir: "models",
  modelName: "Xenova/all-mpnet-base-v2",
  allowRemoteModels: true
}

export async function setup(opt = { }) {
  env.allowRemoteModels = opt.allowRemoteModels ?? state.allowRemoteModels;
  env.localModelPath = opt.modelDir ?? state.modelDir;
  env.cacheDir = env.localModelPath;
  state.modelName = opt.modelName ?? state.modelName;
  state.model = new HuggingFaceTransformersEmbeddings({ modelName: state.modelName });
  state.init = true;
  // console.log({ embed_setup: opt, state });
}

// creates a vector from a document (text embed)
export async function vectorize(docs, opt = {}) {
  if (!state.init) {
    await setup();
  }

  docs = Array.isArray(docs) ? docs : [docs];

  const res = await new Promise(resolve => {
    setTimeout(() => {
        // unblock vm when this is called
        // in a loop inside the doc server
        embed_docs(docs, resolve);
    }, 0);
  });
  
  if (opt.debug) {
    console.log({ env, model: state.model, res });
  }

  return res;
}

// utility function that computes index from vector
// as the sqrt(sum of squared vector elements)
export function vector_to_index(vec) {
  return Math.sqrt(vec.map(v => v * v).reduce((x, y) => x + y));
}

// chunks are records containing { index, vector }
// returns a value 0 (dissimilar) to 1 (very similar)
export function cosine_similarity(ch1, ch2) {
  const vec1 = ch1.vector;
  const vec2 = ch2.vector;
  let dotProduct = 0;

  for (let i = 0; i < vec.length; i++) {
    dotProduct += vec1[i] * vec2[i];
  }

  return dotProduct / (ch1.index * ch2.index);
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
