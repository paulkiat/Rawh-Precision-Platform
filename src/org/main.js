/** main organizational server / broker / meta-data server */

const { server, client } = require('../lib/net').zmq;
const { args } = require('../lib/util');
const log = require('../lib/util').logpre('org');
const store = require('../lib/store');

/**
 * INITIALIZATION
 * 
 * 1. open meta-data data-store
 * 2. open log-data data-store
 * 3. detect first-time setup, create pub/priv key pair
 * 4. starts https listening endpoints
 */

(async () => {
  // initialize meta-data store
  await store.open("org-meta-data");

  // start server listening end-point
  server(3000, async req => {
    log(`<<< ${JSON.stringify(req)}`);
    req.ok = 1;
    return req;
  });

  const client1 = client("127.0.0.1", 3000);
  const client2 = client("127.0.0.1", 3000);
  
  // test clients
  for (let i = 0; i < 0; i++) {

    const r1 = await client1.call({ seed: 1, i });
    const r2 = await client1.call({ seed: 2, i });

    log(`>>>`, { r1, r2 });
  }
})();