// llm worker process isolates heavy cpu/mem from node api
// and message interfaces, without this, the api proxy thread
// is blocked and causes the node to be marked dead since it
// is unable to complete heartbeats within the dead node timeout

const util = require('../lib/util');
const sessions = {};

(async () => {
  
  const { chat } = await require('../llm/api.js').init();

  process.on("message", async (work) => {
    const { cmd, mid, msg, debug } = work;
    const { sid, query } = msg;
    switch (cmd) {
      case "ssn-start":
        const newsid = util.uid();
        sessions[newsid] = await chat.create_session({
          debug,
          gpuLayers: msg.gpu,
          modelName: msg.model
        });
        // console.log({ mid, newsid });
        process.send({ mid, msg: { sid: newsid } });
        break;
      case "ssn-end":
        if (sessions[sid]) {
          delete sessions[sid];
          process.send({ mid, msg: true });
        } else {
          process.send({ mid, msg: false });
        }
        break;
      case "ssn-query":
        const ssn = sessions[sid];
        // console.log({ mid, sid, query, ssn, debug });
        if (ssn) {
          const answer = debug ?
            await ssn.prompt_debug(query) :
            await ssn.prompt(query);
          process.send({ mid, msg: { answer } });
        } else {
          process.send({ mid, msg: { error: "missing session" } });
        }
        break;
      case "query":
        const temp = await chat.create_session({
          debug,
          gpuLayers: msg.gpu,
          modelName: msg.model,
          xsystemPrompt: [
            "You are an AI assistant that strives to answer as concisely as possible. ",

            "You are being provided a set of text fragments seperated by ----- which is the ",
            "context you must use to answer a Question at the end.\n",

            "If the answer is not found in the provided texts, reply that you do not ",
            "have a document related to the question.\n",

            "If a question does not make any sense, try to answer based on your best understanding of the intent of the question.\n",
            "If you don't know the answer to a question, do not guess or share false or incorrect information.",
          ].join("\n")
        });
        const answer = debug ?
          await temp.prompt_debug(query) :
          await temp.prompt(query);
        process.send({ mid, msg: { answer } });
      default:
        process.send({ mid, msg: { error: `invalid command: ${cmd}` } });
        break;
    }
  });

})();