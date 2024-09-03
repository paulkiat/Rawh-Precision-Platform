//---------- P1: vc-backed-llama-gguf --------------//
// https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q2_K.gguf

//---------- P2: Hermes Trismegistus(Thrice Greatness)---------------//
// https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF/blob/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf

//---------- P3: Crispy-Sentence-Embeddings --------------//
// https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1/resolve/main/gguf/mxbai-embed-large-v1-f16.gguf


/** Choose Your Player.. */
import path from "path"; path;
import {
    LlamaModel,
    LlamaContext,
    LlamaChatSession,
    LlamaGrammar
} from "node-llama-cpp";

const state = { };

export async function setup(opt = { }) {

  const systemPrompt = state.systemPrompt = alpaca ? [
    "### Instruction:\n",
    "You are an assistant that strives to answer as concisely as possible There is no need for pleasantries or extranious commentary.\n",
    "If a question does not make any sense, try to answer based on your best understanding of the intent of the question.\n",
    "If you don't know what the answer to a question, do not guess or share false or incorrect information."
  ] : [
    "You are an AI assistant that strives to answer as concisely as possible. This is no need for pleasantries or other commentary.\n",
    "If a question does not make any sense, try to answer based on your best understanding of the intent of the question.\n",
    "If you don't know what the answer to a question, do not guess or share false or incorrect information."
  ].join('');

  const modelName = opt.modelName ?? "llama-2-7b-chat.Q2_K.gguf";
  const modelPath = path.join(opt.modelDir ?? "models", modelName);
  const contextSize = opt.contextSize ?? 4096;
  const batchSize = opt.batchSize ?? 4096;
  const useMlock = opt.mlock ? true : false;
  const useMmap = opt.mmap ? true : false;
  const gpuLayers = opt.gpulayers ?? 0;
  const threads = opt.threads ?? undefined;
  const model = new LlamaModel({
         modelPath,
         gpuLayers,
         useMlock,
         useMmap,
  });

  Object.assign(state, {
    debug: opt.debug ?? false,
    model,
    threads,
    batchSize,
    contextSize: Math.min(contextSize, model.trainContextSize || contextSize),
    systemPrompt: opt.systemPrompt ?? systemPrompt
  });

  if (opt.debug) {
    console.log({
      llm_setup: opt,
      modelName,
      modelPath,
      gpuLayers,
      batchSize,
      contextSize,
      threads,
      useMmap,
      useMlock,
      aplaca: opt.alpaca
    });
  }
}

export async function create_session(opt = { }) {
  const { promptWrapper, systemPrompt } = state;
  const { model, batchSize, contextSize, threads } = state;
  const grammar = opt.grammar ? await LlamaGrammar.getFor("json") : undefined;

  const context = new LlamaContext({
    model,
    batchSize,
    contextSize,
    threads,
  });

  // intercept context eval so we can watch exactly what's sent to the llm
  const oeval = context.evaluate.bind(context);
  async function *nueval(tokens, args) {
    if (opt.debug === 42) {
      console.log({ to_llm: context.decode(tokens) });
    }
    for await (const value of oeval(tokens, args)) {
      yield value;
    }
  }
  context.evaluate = nueval;

  const session = new LlamaChatSession({
    context,
    promptWrapper,
    systemPrompt: opt.systemPrompt ?? state.systemPrompt,
    printLLamaSystemInfo: opt.debug ? true : false,
    contextSequence: context.getSequence ? context.getSequence() : undefined,
  });

  // console.log({ session } );

  const fns = {
    async prompt(prompt, onToken) {
      return prompt_and_response(prompt, onToken, session, grammar);
    },

    async prompt_debug(prompt, onToken) {
      if (opt.debug !== 42) {
        console.log({  user: prompt });
      }
      let time = Date.now();
      let chunks = 0;
      const response = await fns.prompt(prompt, (chunk) => {
        const text = model.detokenize ?
          model.detokenize(chunk) : // v3.x
          context.decode(chunk);    // v2.x
        if (onToken) {
            onToken(text);
        }
        if (chunks++ === 0) {
            console.log('-----[[  llm reply  ]]-----');
        }
        process.stdout.write(text);
      });
      time = (Date.now() - time).toString();
      time = time.padStart(11 - (11 - time.length) / 2, ' ');
      time = time.padEnd(11, ' ');
      console.log(`\n-----[[ ${time} ]]-----`);
      return response;
    }
  };

  return fns;
}

async function prompt_and_response(prompt, onToken, session, grammar) {
  return session.prompt(prompt, {
    onToken,
    grammar,
    temperature: 0.08,
    repeatPenalty: {
      lastTokens: 64,
      penalizeNewLine: true
    }
  });
}