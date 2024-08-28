// llm worker process isolates heavy cpu/mem from node api
// and message interfaces, without this, the api proxy thread
// is blocked and causes the node to be marked dead since it
// is unable to complete heartbeats within the dead node timeout

const util = require('../lib/util');
const sessions = {};

(async () => {
  
  const { chat } = await require('../llm/api.js').init();

  process.on("message", async (work) => {
    // console.log({ wrk_got: work });
    const { cmd, mid, msg, debug } = work;
    const { sid, query } = msg;
    switch (cmd) {
      case "ssn-start":
        const newsid = util.uid();
        sessiona[newsid] = await chat.create_session({ debug });
        // console.log({ mid, newsid });
        process.send({ mid, msg: { sid: newsid} });
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
          process.send({ mid, msg: { error: "missing session"} });
        }
        break;
      default:
        process.send({ mid, msg: { error: `invalid command: ${cmd}` } });
        break;
    }
  });

})();