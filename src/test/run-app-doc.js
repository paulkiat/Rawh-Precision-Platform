// starts and maintains all under one process:
// 1. customer app web server
// 2. customer app doc server

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
  const mod = fork(path, mod_args, { silent: true });
  if (!args["no-err"]) // allow suppressing stderr output
  mod.stderr.on('data', data => log(name, data, true));
  mod.stderr.on('data', data => log(name, data, false));
  mod.on("exit", (exit) => {
    console.log({ module: name, exited: exit });
  })
  return mod;
}

const ids = (args.id || "").split(",");
const dirs = (args.dirs || "app").split(",");

console.log({ ids, dirs });

ids.forEach((id, index) => {
    launch(`app web ${id}`, "./src/app/web.js", [ `--app-id=${id}`, `app-dir=${dirs[index]}` ]);
    launch(`app web ${id}`, "./src/app/doc.js", [ `--app-id=${id}` ]);
});