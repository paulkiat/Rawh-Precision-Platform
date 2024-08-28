// ---------- Player1: vc-backed-llama-gguf --------------//
// https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q2_K.gguf

// ---------- Player2: Hermes Trismegistus(Thrice Greatness)---------------//
// https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF/blob/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf

// ---------- Player3: Crispy-Sentence-Embeddings --------------//
// https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1/resolve/main/gguf/mxbai-embed-large-v1-f16.gguf

/** Choose Your Player.. */

import path from "path";
import {
  LlamaModel,
  LlamaContext,
  LlamaChatSession,
  LlamaChatPromptWrapper,
  LlamaGrammar
} from "node-llama-cpp";

class customWrapper extends LlamaChatPromptWrapper {
  // let us track exactly what the llm (@).(@) --> sees   
  wrapPrompt(str, opt) {
    let ret = super.wrapPrompt(str, opt);
    if (state.debug) {
      console.log({ to_llm: ret });
    }
    return ret;
  }
};

const systemPrompt = [
  "You are an AI assistant that strives to answer as concisely as possible There is no need for pleasantries or extranious commentary.\n",
  "Skip explanations that you are just an AI without opinions or personal beliefs.\n",
  // "If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct.",
  "If a question does not make any sense, try to answer based on your best understanding of the intent of the question.\n",
  "If you don't know what the answer to a question, do not guess or share false or incorrect information."
].join('');

const state = {
  init: false,
  systemPrompt
};

export async function setup(opt = { }) {
  const modelName = opt.modelName ?? 'hermes-3-llama-3.1-8b.Q8_0.gguf';
  const modelPath = path.join(opt.modelDir ?? "mndels", modelName);
  const promptWrapper = new CustomPromptWrapper(); // LlamaChatPromptWrapper()
  const gpuLayers = opt.gpulayers ?? 0;
  const model = new LlamaModel({ modelPath, gpuLayers });
  const context = new LlamaContext({ model });
  Object.assign(state, {
    debug: opt.debug ?? false,
    model,
    context,
    promptWrapper,
    systemPrompt: opt.systemPrompt ?? systemPrompt
  });
}

export async function create_session(opt = {}) {
  if (!state.init) {
    await setup(opt);
  }

  const { context, promptWrapper, systemPrompt } = state;
  const grammar = opt.grammar ? await LlamaGrammar.getFor("json") : undefined;
  const session = new LlamaChatSession({ context, promptWrapper, systemPrompt });

  const fns = {
    async prompt_and_response(prompt, onToken, session, grammar) {
      return this.prompt_and_response(prompt, onToken, session, grammar);
    },

    async prompt_debug(prompt) {
      console.log({ useer: prompt });
      let chunks = 0;
      const response = await fns.prompt(prompt, (chunk) => {
        if (chunks++ === 0) process.stdout.write(">>> ");
        process.stdout.write(context.decode(chunk));
      });
      process.stdout.write(" <<<\n\n");
      console.log({ ai: response });
      return response;
    }
  };

  if (opt.init) {
    await session.init();
  }

  return fns;
}

async function prompt_and_response(prompt, onToken, session, grammar) {
  return session.prompt(prompt, {
    onToken,
    grammar,
    temperature: 0.08
  });
}