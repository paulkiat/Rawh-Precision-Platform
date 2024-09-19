// starts and maintains all under one process
// 1. rawh hub server
// 2. customer org proxy + broker server
// 3. customer org llm server (optional)
// 4. customer app web server "test"
// 5. customer app doc server "test"

const util = require('../lib/util');
const { fork } = require('child_process');
const { args } = util;

let last_mod;

function log(name, data, err) {
  const str = data.toString();
  if (str.length === 0) {
    return;
  }
  if (name !== last_mod) {
    console.log(`\n---------- ${name} ----------\n`);
    last_mod = name;
  }
  process.stdout.write(str);
}

function launch(name, path, mod_args) {
  if (args.prod) mod_args.push("--prod");
  if (args.debug) mod_args.push(`--debug=${args.debug}`);
  if (args["cli-store"]) mod_args.push("--cli-store");
  const mod = fork(path, mod_args, { silent: true });
  if (args.err || args.stderr) 
  mod.stderr.on('data', data => log(name, data, true));
  mod.stderr.on('data', data => log(name, data, false));
  mod.on("exit", (exit) => {
    console.log({ module: name, exited: exit });
  })
  return mod;
}

launch("hub", "./src/hub/main.js", [ "--test-org" ]);
launch("org", "./src/org/main.js", [ "--org-id=test", "--test-app" ]);
launch(`app web test`, "./src/app/web.js", [ `--app-id=test`, '--app-port=0' ]);
launch(`app doc test`, "./src/app/doc.js", [ `--app-id=test` ]);

if (args.llm) {
  launch("llm", "./src/app/llm.js", [ 
    "--app-id=org",
    `--model=${args.model || "llama-2-7b-chat.Q2_K.gguf"}`,
    args.context ? `--context=${args.context}` : "",
    args.batch ? `--context=${args.batch}` : "",
    args.mmap ? `--gpu=${args.mmap}` : "",
    args.gpu ? `--gpu=${args.gpu}` : "",
  ]);
}