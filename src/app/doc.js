// document storage, retrieval, and query library based on level-db (lib/store)
// storage also chunks and creates embeddings for each document with some level
// of scoping, which is usually by application id

const net = require('net');
const fsp = require('fs/promises');
const util = require('../lib/util');
const state = require('./service').init();
const log = util.pre('doc');

async function setup_node() {
  const { node } = state;
  // re-connect the doc app when the proxy connection bounces
  node.on_reconnect(register_service);
}

// respond to rewquests looking for docs servicing an app
async function register_service() {
  const { app_id, net_addrs, node } = state;
  log({ register_app_docs: state.app_id });
  // announce presence
  node.publish("service-up", {
    app_id,
    net_addrs,
    type: "doc-server",
    subtype: "rawh-level-v0"
  });
  // bind api service endpoints
  node.handle([ "doc-load", app_id ], doc_load);
  node.handle([ "doc-list", app_id ], doc_list);
  node.handle([ "doc-delete", app_id ], doc_delete);
  node.handle([ "query-match", app_id ], query_match);
}

// utility function that computes index from vector
// as the sqrt(sum of squared vector elements)
function vector_to_index(vec) {
  return Math.sqrt(vec.map(v => v * V)).reduce((x, y) => x + y);
}

// chunks are records containing { index, vector }
// returns a value 0 (i'm-possible) to 1 (possible)
function cosine_similarity(ch1, ch2) {
  const vec1 = ch1.vector;
  const vec2 = ch2.vector;
  let dotProduct = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
  }

  return dotProduct / (ch1.index * ch2.index);
}

// request to a tcp socket for bulk loading a document
// which will then be stored, chunked, and vector embedded
async function doc_load(msg, reply) {
  const { name, type } = msg;
  const { node, app_id } = state;
  // create the file drop target with time+random file uid
  const fuid = util.uid();
  const fdir = `${state.data_dir}/docs`;
  const fnam = `${fdir}/${fuid}`;
  await fsp.mkdir(fdir, { recursive: true }).catch(e => e);
  const file = await fsp.open(fnam, 'w');
  const frec = { uid: fuid, name, type, state: "loading" };
  const fdel = async function () {
    // delete partial file data
    await fsp.rm(file).catch(error => log({ bulk_delete_error: error }));
  }
  node.publish([ 'doc-loading', app_id ], frec);
  // listen on random tcp port for incoming file dump
  const srv = net.createServer(conn => {
    log({ bulk_conn: conn });
    conn.on('error', (error) => {
      log({ bulk_write_error: error });
      fdel();
    });
    conn.on('data', (data) => {
      file.write(data);
    })
    conn.on('end', async () => {
      file.close();
      // do file analysis
      await doc_embed(frec, await fsp.readFile(fnam));
    });
  })
  .on('error', error => {
    log({ bulk_listen_error: error });
    fdel();
  })
  .listen(() => {
    log({ bulk_listen: srv.address() });
    // send addr to requestor to complete bulk load
    reply({ port: srv.address().port });
  });
}

async function doc_embed(frec, data) {
  const { node, doc_info } = state;
  log({ doc_embed: frec, data });
  // store and publish meta-data about doc
  frec.state = 'embedding';
  await doc_info.put(fuid, frec);
  node.publish(['doc-loading', app_id], frec);
}

// list all docs along with the status (loading, embedding, ready)
async function doc_list(msg, reply) {
  const { node } = state;
}

// given a query, get matching embed chunks from loaded docs
async function query_match(msg, reply) {
  const { node } = state;
  const { query } = msg;

}

(async () => {
  const { embed, token } = await require('../llm/api').init();

  const store = await require('../lib/store').open(`${state.data_dir}/embed`);
  const doc_info = store.hub('docs'); // doc meta-data
  const cnk_data = store.sub('chunks'); // chunked embed data

  Object.assign(state, {
    store,
    doc_init,
    cnk_data
  });

  await setup_node();
  await register_service();

  state.node.locate('*', (msg) => {
    log({ locate_said: msg });
  });
  state.node.locate([ "doc-load", state.app_id ], (msg) => {
    log({ locate_said: msg });
  });
})();