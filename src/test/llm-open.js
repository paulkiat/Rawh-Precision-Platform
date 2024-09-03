// minimum llm open test w/ sample query
// for debug reporting to node-llama-cpp discussions

async function run(opt = { }) {
  const path = require("path");
  const {
      LlamaModel,
      LlamaContext,
      LlamaChatSession,
  } = (await import("node-llama-cpp"));

  const modelName = opt.modelName ?? "llama-2-7b-chat.Q2_K.gguf";
  const modelPath = path.join(opt.modelDir ?? "models", modelName);
  const contextSize = opt.contextSize ?? 4096;
  const batchSize = opt.batchSize ?? 4096;
  const gpuLayers = opt.gpulayers ?? 0;
  const threads = opt.threads ?? undefined;
  const model = new LlamaModel({
         modelPath,
         gpuLayers,
  });

  const context = new LlamaContext({
    model,
    batchSize,
    contextSize,
    threads,
  });

  const session = new LlamaChatSession({
    context,
    systemPrompt: opt.systemPrompt,
    printLlamaSystemInfo: opt.debug ? true : false,
    contextSequence: context.getSequence ? context.getSequence() : undefined,
  });

  const fns = {
    async prompt(prompt, onToken) {
      return session.prompt(prompt, {
        onToken,
        temperature: 0,
        repeatPenalty: {
            lastTokens: 64,
            penalizeNewLine: true
        }
      });
    },

    async prompt_debug(prompt, onToken) {
      console.log({ user: prompt });
      let time = Date.now();
      let chunks = 0;
      const response = await fns.prompt(prompt, (chunk) => {
        const text = model.detokenize ?
          model.detokenize(chunk) : // v 3.x
          context.decode(chunk);    // v 3.x
        if (onToken) {
          onToken(text);
        }
        if (chunks++ === 0) {
          console.log('------[[ llm reply ]]------')
        }
        process.stdout.write(text);
      });
      time = (Date.now() - time).toString();
      time = time.padStart(11 - (11 - time.length) / 2, ' ');
      time = time.padEnd(11, ' ');
      console.log(`\n------[[ ${time} ]]------`);
      return response;
    }
  };

    return fns;
}

run({
  modelName: process.argv[2] || "mxbai-embed-large-v1-f16.gguf"
}).then(fns => {
  fns.prompt_debug("hello, what's your name?");
});