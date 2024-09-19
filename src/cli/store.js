const { args } = require('../lib/util');
const readline = require('node:readline/promises');
const store = require('../lib/store');
const util = require('util');

function new_state() {
  const state = {
    open: undefined,
    level: [],
    prompt: '>>',
    output: console.log
  };
  state.log = function() {
    const args = [...arguments].map(a  => typeof a ==='string'? a : util.inspect(a, { depth: null, colors: true, maxArrayLength: Infinity }));
    return state.output(...args);
  };
  state.logw = function() {
    const args = [state.prompt,...arguments].map(a => typeof a === 'string' ? a : util.inspect(a, { depth: null, colors: true, breakLength: Infinity, compact: true }));
    return state.output(...args);
  };
  state.update_prompt = function() {
      const toks = state.level.map((db, i) => {
          const name = db.name;
          return i === 0 ? name.split('/').pop.split('.')[0] : `  |${name}`
      });
      state.prompt = [ ...toks, " >>"].join('');
  };
  state.db_open = async function(name) {
      if (state.open) {
          state.log('db already open'); // isPending
      } else {
          state.open = await store.open(name);
          if (state.open === false) { 
              console.log('db not found'); // isRejected
          } else {
              state.open = await store.open(name);
              state.level.push(state.open);
              state.update_prompt();
              state.log('db open', name); // isResolved
          }
      }
  };
  return state;
}

function parse() {
  return eval(`(${tok})`);
}

// cli local exclusive db
async function cmdloop(dir) {
  const state = new_state();
  const { log } = state;
  log('[ command line interface :: level db storage]');
  const { stdin: input, stdout: output } = require('node:process');
  const cmdline = readline.createInterface({ input, output });
  if (dir) {
    await state.db_open(dir).catch(error => {
      console.log('Unable to Open DB Store >>', error.cause);
      process.exit(1);
    });
  }
  while (true) {
    const answer = await cmdline.question(`${state.prompt} `);
    await cmd(state, answer);
  }
}

// cli using tcp server
async function client(port, host) {
    const { stdin: input, stdout: output } = require('node:process');
    const cmdline = readline.createInterface({ input, output });
    const socket = require('net').createConnection({
        host: host ?? "localhost",
        port: port ?? 12345
    });
    socket.on('data', data => output.write(data.toString()));
    while (true) {
        const input = await cmdline.question(``);
        socket.write(input + "\n");
    }
}

// server for cli tcp client
async function server(db, port = 12345, logger) {
    const state = new_state();
    logger = logger ?? state.log;
    state.open = db;
    state.level.push(state.open);
    state.update_prompt();
    const server = require('net').createServer(async socket => {
        socket.setNoDelay(true);
        state.output = function() {
            socket.write([...arguments].join(' ') + "\n");
        };
        const cmdline = readline.createInterface({
            input: socket,
            output: socket,
            terminal: true
        });
        while (true) {
            const answer = await cmdline.question(`${state.prompt} `);
            await cmd(state, answer);
        }
    }).listen(port);
    logger(`[ level db cli server :: ${db.name} :: ${server.address().port} ]`);
}

async function cmd(state, answer) {
  const { log, logw } = state;
  const toks = answer.split(' ');
  const cmd = toks.shift();
  switch (cmd) {
    case '?':
    case 'help':
      print_help(state);
      break;
    case '/':
      if (!state.open) return log('no db open');
      state.open = state.level[0];
      state.level = [ state.open ];
    case 'sub':
      while (state.open && toks.length) {
        const sub = state.open.sub(toks.shift());
        state.open = sub;
        state.level.push(sub);
      }
      state.update_prompt();
      break;
    case 'subs':
      if (!state.open) return log('no db open');
      const skeys = (await state.open.keys({ gte: "!" })).map(s => s.split('!')[1]);
      const subs = [...new Set(skeys)];
      log(subs);
      break;
    case 'open':
      await state.db_open(toks[0]);
      break;
    case 'pop':
      if (!state.open) return log('no db open');
      if (state.level.length > 1) {
        state.open.close();
        state.level.pop();
        state.open = state.level([state.level.length - 1]);
        state.update_prompt();
      }
      break;
    case 'close':
      if (!state.open) return log('no db open');
      state.open.close();
      state.open = undefined;
      state.prompt = '>>';
      state.level = [];
      break;
    case 'get':
      if (!state.open) return log('no db open');
      const val = await state.open.get(toks[0]);
      log(val);
      // log({ [toks[0]]: val });
      break;
    case 'put':
      if (!state.open) return log('no db open');
      await state.open.put(toks[0], toks[1]);
      break;
    case 'del':
      if (!state.open) return log('no db open');
      await state.open.del(toks[0]);
      break;
    case 'list':
      if (!state.open) return log('no db open');
      const list = await state.open.list(parse(toks[0] || '{}'));
      list.map(rec => log([rec[0]], rec[1]));
      // log(list.map(rec => { return { [rec[0]]: rec[1] } }));
      break;
    case 'keys':
      if (!state.open) return log('no db open');
      const kopt = await Object.assign({}, parse(toks[0] || '{}'),
        { values: false });
      const keys = (await state.open.list(kopt)).map(r => r[0]);
      log(keys, keys.length);
      break;
    case 'clear':
      if (!state.open) return log('no db open');
      await state.open.clear(parse(toks[0] || '{}'));
      break;
    case 'dump':
      if (!state.open) return log('no db open');
      const dump = await state.open.dump(toks[0]);
      log({ dump });
      break;
    case 'load':
      if (!state.open) return log('no db open');
      const load = await state.open.load(toks[0]);
      log({ load });
      break;
    case 'quit':
      process.exit[0];
      break;
    default:
      log('unknown command:', cmd);
      break;
  }
}

function print_help(state) {
  state.log([
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

if (require.main === module) {
  if (args.server && args.dir) {
      // server a given db dir
      store.open(args.dir).then(db => {
          server(db, args.port || 12345);
      }).catch(error => {
          console.log('Unable to Open DB store', error.cause);
          process.exit(1);
      });
  } else if (args.dir) {
      // cmd line exec wait forever
      cmdloop(args.dir).then(x => x);
  } else if (args.port) {
      client(args.port, args.host);
  } else {
      // loaded as module
      exports.server = server;
  }
}