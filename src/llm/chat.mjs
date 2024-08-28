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
  GeneralChatPromptWrapper,
  LlamaChatPromptWrapper,
  LlamaGrammar
} from "node-llama-cpp";

// const PromptClass = GeneralChatPromptWrapper;
const ChosenPromptClass = LlamaChatPromptWrapper;

class CustomPromptWrapper extends ChosenPromptClass /*LlamaChatPromptWrapper*/ {
  // let us track exactly what the llm (@).(@) --> sees   
  wrapPrompt(str, opt) {
    let ret = super.wrapPrompt(str, opt);
    // to get the exact details of what the llm sees
    if (state.debug == 42) {
      console.log({ send_to_llm: ret });
    }
    return ret;
  }
}

const systemPrompt = [
  // "You are an AI assistant that strives to answer as concisely as possible There is no need for pleasantries or extranious commentary.\n",
  // "Skip explanations that you are just an AI without opinions or personal beliefs.\n",
  "You are an AI assistant that strives to answer as concisely as possible. This is no need for pleasantries or other commentary.\n",
  "If a question does not make any sense, try to answer based on your best understanding of the intent of the question.\n",
  "If you don't know what the answer to a question, do not guess or share false or incorrect information."
].join('');

const state = {
  init: false,
  systemPrompt
};

export async function setup(opt = { }) {
  if (state.init) {
      return;
  } else {
      state.init = true;
  }

  const modelName = opt.modelName ?? 'llama-2-7b-chat.Q2_K.gguf';
  const modelPath = path.join(opt.modelDir ?? "models", modelName);
  const promptWrapper = opt.debug ? new CustomPromptWrapper() : new LlamaChatPromptWrapper();
  const contextSize = opt.contextSize ?? 4096;
  const batchSize = opt.batchSize ?? 4096;
  const gpuLayers = opt.gpulayers ?? 0;
  const model = new LlamaModel({
    modelPath,
    gpuLayers
  });
  const context = new LlamaContext({
    model,
    batchSize,
    contextSize
  });
  Object.assign(state, {
    debug: opt.debug ?? false,
    model,
    context,
    promptWrapper,
    systemPrompt: opt.systemPrompt ?? systemPrompt
  });

  if (opt.debug) {
    console.log({ llm_setup: opt, modelName, modelPath });
  }
}

// future allow aborting a runaway response
class AbortIt extends EventTarget {
  get aborted() {
    return false;
  }
  get reason() {
    console.log('reason() called');
  }
  onabort() {
    console.log('on_abort', [...arguments]);
  }
  throwIfAbortedt() {
    console.log('throwIfAborted', [...arguments]);
  }
}

export async function create_session(opt = {}) {
  if (!state.init) {
    await setup(opt);
  }

  const { context, promptWrapper, systemPrompt } = state;
  const grammar = opt.grammar ? await LlamaGrammar.getFor("json") : undefined;
  const session = new LlamaChatSession({
    context,
    promptWrapper,
    systemPrompt: opt.systemPrompt ?? systemPrompt,
    printLLamaSystemInfo: opt.debug ? true : false,
  });

  const fns = {
    async prompt(prompt, onToken) {
      return prompt_and_response(prompt, onToken, session, grammar);
    },

    async prompt_debug(prompt, onToken) {
      if (opt.debug !== 42) {
        console.log({ useer: prompt });
      }
      let time = Date.now();
      let chunks = 0;
      const response = await fns.prompt(prompt, (chunk) => {
        const text = context.decode(chunk);
        if (onToken) {
            onToken(text);
        }
        if (chunks++ === 0) {
            console.log('-----[[  llm reply  ]]-----');
        }
        // process.stdout.write('{'+text+'}');
        process.stdout.write(text);
      });
      time = (Date.now() - time).toString();
      time = time.padStart(11 - (11 - time.length) / 2, ' ');
      time = time.padEnd(11, ' ');
      console.log(`\n-----[[ ${time} ]]-----`);
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
    signal: new AbortIt(),
    onToken,
    grammar,
    // msxTokens: 5,
    temperature: 0.08,
    repeatPenalty: {
      lastTokens: 64,
      penalizeNewLine: true
    }
  });
}