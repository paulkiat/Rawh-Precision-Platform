const { env } = process;
const { args } = require('../lib/util');
const { proxy } = require('../lib/net');
const log = require('../lib/util').logpre('app');
const web = require('../lib/web');
const app_handler = require('express')();

const state = {};
Object.assign(state, {
  app_port: args['app-port'] || (args.prod ? 80 : 7000),
  app_handler
});

async function initialize_app_handlers() {
  app_handler
    .use(require('serve-static')('web/org', { index: [ "index.html" ]}))
    .use((req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    })
  ;
}

(async () => {
  await initialize_app_handlers();
  await web.start_web_listeners(state);
})();