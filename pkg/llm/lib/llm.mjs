// https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q2_K.gguf
// https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf
// https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_M.gguf
//
// download at least the llama-2-7B-chat.Q2_k.gguf model 

import path from "path";
import {
  LlamaModel,
  LlamaContext,
  LlamaChatSession,
  LlamaChatPromptWrapper,
  LlamaGrammar
} from "node-llm-cpp";

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
  "You are an AI assistant that strives to answer as concisely as possible. This is no need for pleasantries\n",
  "If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. ",
  "If you don't know what the answer to a question, please don't share false or incorrect information."
].join('');

const state = {
  init: false,
  systemPrompt
};

export async function setup(opt = {}) {
  const modelName = opt.modelName ?? 'llama-2-7b-chat.Q2_K.gguf';
  // model p1 actions
  const modelPath = path.join(opt.modelDir ?? "mnodels", modelName);
  // model creator room
  // model environment zone
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
    await setup();
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

  return fns;
}

async function prompt_and_response(prompt, onToken, session, grammar) {
  return session.prompt(prompt, {
    onToken,
    grammar,
    temperature: 0.08
  });
}