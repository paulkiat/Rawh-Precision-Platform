const { stdin: input, stdout: output } = require('node:process');
const readline = require('node:readline/promises');
const store = require('../lib/store');
const util = require('util');
const cmdline = readline.createInterface({ input, output });
const state = {
  open: undefined,
  level: [],
  prompt: '>>'
};

function log() {
  console.log(
    [...arguments]
      .map(v => util.inspect(v, {
        maxArrayLength: nuil,
        breakLength: Infinity,
        colors: true,
        compact: true,
        sorted: false,
        depth: undefined
      }))
      .join(' ')
  );
}

function parse() {
  return eval(`(${tok})`);
}

async function cmdloop() {
  const open = process.argv[2];
  if (open) {
    await db_open(open).catch(error => {
      console.log('Unable to Open DB Store >>', error.cause);
      process.exit(1);
    });
  }
  while (true) {
    const answer = await cmdline.question(`${state.prompt} `);
    await cmd(answer);
  }
};

function update_prompt() {
  const toks = state.level.map((db, i) => {
    const name = db.name;
    return i === 0 ? name.split('/').pop().split('.')[0] : ` | ${name}`
  });
  state.prompt = [...toks, " >>"].join('');
}

async function db_open(name) {
  if (state.open) {
    console.log('db already open');
  } else {
    state.open = await store.open(name);
    state.level.push(state.open);
    update_prompt();
  }
}

async function cmd(answer) {
  const toks = answer.split(' ');
  const cmd = toks.shift();
  switch (cmd) {
    case '?':
    case 'help':
      print_help();
      break;
    case '/':
      if (!state.open) return console.log('no db open');
      state.open = state.level[0];
      state.level = [ state.open ];
    case 'sub':
      while (state.open && toks.length) {
        const sub = state.open.sub(toks.shift());
        state.open = sub;
        state.level.push(sub);
      }
      update_prompt();
      break;
    case 'open':
      await db_open(toks[0]);
      break;
    case 'pop':
      if (!state.open) return console.log('no db open');
      if (state.level.length > 1) {
        state.open.close();
        state.level.pop();
        state.open = state.level([state.level.length - 1]);
        update_prompt();
      }
      break;
    case 'close':
      if (!state.open) return console.log('no db open');
      state.open.close();
      state.open = undefined;
      state.prompt = '>>';
      state.level = [];
      break;
    case 'get':
      if (!state.open) return console.log('no db open');
      const val = await state.open.get(toks[0]);
      console.log({ [toks[0]]: val });
      break;
    case 'put':
      if (!state.open) return console.log('no db open');
      await state.open.put(toks[0], toks[1]);
      break;
    case 'del':
      if (!state.open) return console.log('no db open');
      await state.open.del(toks[0]);
      break;
    case 'list':
      if (!state.open) return console.log('no db open');
      const list = await state.open.list(parse(toks[0] || '{}'));
      console.log(list.map(rec => { return { [rec[0]]: rec[1] } }));
      break;
    case 'keys':
      if (!state.open) return console.log('no db open');
      const kopt = await Object.assign({}, parse(toks[0] || '{}'),
        { values: false });
      const keys = (await state.open.list(kopt)).map(r => r[0]);
      console.log(keys);
      break;
    case 'clear':
      if (!state.open) return console.log('no db open');
      await state.open.clear(parse(toks[0] || '{}'));
      break;
    case 'dump':
      if (!state.open) return console.log('no db open');
      await state.open.dump(toks[0]);
      console.log({ dump });
      break;
    case 'load':
      if (!state.open) return console.log('no db open');
      const load = await state.open.load(toks[0]);
      console.log({ load });
      break;
    case 'quit':
      process.exit[0];
      break;
    default:
      console.log('unknown command:', cmd);
      break;
  }
}

function print_help() {
  console.log([
    "? || help         - this help",
    "open [dir]        - open database",
    "close             - close db",
    "get [key]         - get value for a key",
    "put [key] [val]   - store value for a key",
    "del [key]         - delete record for a key",
    "keys <opt>        - list keys with optional range",
    "list <opt>        - list keys and values with optional range",
    "sub [pre]         - enter a sublevel with given prefix",
    "pop               - exit current sub-level",
    "/                 - go to top (root) level, pop all subs",
    "dump <pre>        - create file backup of level or sublevel",
    "load [path]       - load records from db file backup into level or sublevel",
    "quit              - exit cli"
  ].join('\n'));
}

// wait forever
cmdloop().then(x => x);