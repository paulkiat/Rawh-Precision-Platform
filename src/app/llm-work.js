const { parentPort } = require('worker_threads');
const util = require('../lib/util');
const session = {};

(async () => {
  
  const { chat } = await require('../llm/api.js').init();

  parentPort.on("message", msg => {
    const { cmd, mid, sid, query } = msg;
    switch (cmd) {
      case "ssn-start":
        const uid = util.uid();
        const ssn = session(uid) = chat.create_session();
        parentPort.postMessage({ mid, msg: ssn });
        break;
      case "ssn-end":
        if (sessions[sid]) {
          delete sessions[sid];
          parentPort.postMessage({ mid, msg: true });
        } else {
          parentPort.postMessage({ mid, msg: false });

        }
        break;
      case "ssn-query":
        if (sessions[sid]) {
          const answer = sessions[sid].prompt_debug(query);
          parentPort.postMessage({ mid, msg: answer });
        } else {
          parentPort.postMessage({ mid, msg: answer });
        }
        break;
      default:
        parentPort.postMessage({ mid, msg: `invalid command: ${cmd}` });
        break;
    }
  });

})();