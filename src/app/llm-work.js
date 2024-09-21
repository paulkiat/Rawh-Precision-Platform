// llm worker process isolates heavy cpu/mem from node api
// and message interfaces, without this, the api proxy thread
// is blocked and causes the node to be marked dead since it
// is unable to complete heartbeats within the dead node timeout

const util = require('../lib/util');
const sessions = {};
const context = {};

function log(debug) {
  if (context.debug) {
    process.send({ debug });
  }
}

function exit() {
  console.log({ llm_work_exit: [...arguments] });
  process.exit(1);
}

process.on("SIGINT", exit);
process.on("SIGTERM", exit);
process.on("uncaughtException", exit);

// check for expiring sessions that haven't been heartbeated
setInterval(() => {
  const now = Date.now();
  for (let [key, rec] of Object.entries(session)) {
    if (rec.timeout < now) {
      delete sessions[key];
      log({
        ssn_expire: key,
        open: Object.keys(sessions).length
      });
    }
  }
}, 5000);


(async () => {
  
  const { chat } = await require('../llm/api.js').init();

  process.on("message", async (work) => {
    const { cmd, mid, msg, debug, text } = work;
    const { sid, query, topic } = msg;
    context.debug = debug;
    const call = {
        time_start: Date.now,
        time_first_token: 0, 
        time_end: 0, 
        time_total: 0,
        token_rate: 0,
        token_count: 0
    };
    const summarize = (call) => {
        const now = call.time_end = Date.now();
        call.token_rate = ((now - call.time_start + call.time_first_token) / call.token_count);
        call.time_total = now - call.time_start;
        process.send({ summary: call });
    };
    const onToken = topic ? (token) => {
      if (call.token_count++ === 0) {
          call.time_first_token = Date.now() - call.time_start;
      }
      process.send({ topic, tokens });
    } : undefined;
    switch (cmd) {
      case "init":
        await chat.setup({
          debug,
          alpaca: msg.alpaca,
          gpuLayers: msg.gpu,
          modelName: msg.mode,
          batchSize: msg.batch,
          contextSize: msg.context,
          threads: msg.threads,
          mlock: msg.mlock,
          mmap: msg.mmap
        });
        context.embed = chat.create_embedder();
        process.send({ mid, msg: { init: true } });
        break;
      case "embed":
          process.send({ mid, msg: (await context.embed(text)).vector });
          break;
      case "ssn-start":
        const newsid = util.uid();
        sessions[newsid] = {
          ssn: await chat.create_session({ debug }),
          timeout: Date.now() + 60000
        };
        process.send({ mid, msg: { sid: newsid } });
        log({
          ssn_start: newsid,
          open: Object.keys(sessions).length
        });
        break;
      case "ssn-query":
        const ssn = sessions[sid];
        if (ssn) {
          // console.log({ mid, sid, query, debug, topic });
          const answer = debug ?
            await ssn.prompt_debug(query, onToken) :
            await ssn.prompt(query, onToken);
          process.send({ mid, msg: { answer } });
        } else {
          process.send({ mid, msg: { error: "missing session" } });
        }
        break;
      case "ssn-end":
        if (sessions[sid]) {
          delete sessions[sid];
          process.send({ mid, msg: true });
        } else {
          process.send({ mid, msg: false });
        }
        log({
          ssn_end: sid,
          open: Object.keys(sessions).length
      });
        break;
      case "ssn-keepalive":
        if (sessions[sid]) {
          sessions[sid].timeout = Date.now() + 60000;
        }
        process.send({ mid, msg: { sid } });
        break;
      case "query":
        // console.log({ mid, sid, query, debug, topic });
        const temp = await chat.create_session({ debug : debug !== 'embed' ? debug : false });
        const answer = debug ?
          await temp.prompt_debug(query, onToken) :
          await temp.prompt(query, onToken);
        process.send({ mid, msg: { answer } });
        summarize(call);
        break;
      default:
        process.send({ mid, msg: { error: `invalid command: ${cmd}` } });
        break;
    }
  });

})();