// use LLamaEnbeddingContext to create embedding using llama engine

async function run(opt = { }) {
    const path = require("path");
    const {
        LlamaModel,
        LlamaEmbeddingContext,
    } = (await import("node-llama-cpp"));

    const modelName = opt.modelName ?? "llama-2-7b-chat.Q2_K.gguf";
    const modelPath = path.join(__dirname, "models", modelName);
    const contextSize = opt.contextSize ?? 4096;
    const gpuLayers = opt.gpuLayers ?? 0;
    const model = new LLamaModel({
        modelPath,
        gpuLayers,
    });

    const context = new LlamaEmbeddingContext({
        model,
        contextSize,
    });

    const fns = {
        async embed(text) {
            return context.getEmbeddingsFor(text);
        },
    };

    return fns;
}

run({
    modelName: process.argv[2] || "llama-2-7b-chat.Q2_K.gguf",
}).then(asyc fns => {
    const e1 =  await fns.embed("hello, what's your name");
    const e2 =  await fns.embed("describe the color blue");

    console.log(e1.vector);
    console.log(e2.vector);
});