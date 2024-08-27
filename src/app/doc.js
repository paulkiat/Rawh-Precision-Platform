// document storage, retrieval, and query library based on level-db (lib/store)
// storage also chunks and creates embeddings for each document with some level
// of scoping, which is usually by application id

const net = require('net');
const fsp = require('fs/promises');
const util = require('../lib/util');
const state = require('./service').init();
const log = util.prelog('doc');

async function setup_node() {
  const { node } = state;
  // re-connect the doc app when the proxy connection bounces
  node.on_reconnect(register_service);
}

// respond to rewquests looking for docs servicing an app
async function register_service() {
  const { app_id, net_addrs, node } = state;
  // announce presence
  node.publish("service-up", {
    app_id,
    net_addrs,
    type: "doc-server",
    subtype: "rawh-level-v0"
  });
  // bind api service endpoints for document operations
  node.handle([ "doc-load", app_id ], doc_load);
  node.handle([ "doc-list", app_id ], doc_list);
  node.handle([ "doc-delete", app_id ], doc_delete);
  node.handle([ "query-match", app_id ], query_match);
}

// utility function that computes index from vector
// as the sqrt(sum of squared vector elements)
function vector_to_index(vec) {
  return Math.sqrt(vec.map(v => v * v)).reduce((x, y) => x + y);
}

// chunks are records containing { index, vector }
// returns a value 0 (dis-similar) to 1 (very similar)
function cosine_similarity(ch1, ch2) {
  const vec1 = ch1.vector;
  const vec2 = ch2.vector;
  let dotProduct = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
    }
  
  return  (ch1.index * ch2.index);
}

// request to a tcp socket for bulk loading a document
// which will then be stored, chunked, and vector embedded
async function doc_load(msg = {}, topic, cid) {
  log({ doc_load: msg, topic, cid });
  const { name, type } = msg;
  const { node, app_id, net_addrs } = state;
  // create the file drop target with time+random file uid
  const fuid = util.uid();
  const fdir = `${state.data_dir}/docs`;
  const fnam = `${fdir}/${fuid}`;
  await fsp.mkdir(fdir, { recursive: true }).catch(e => e);
  const file = await fsp.open(fnam, 'w');
  const fstr = await file.createWriteStream();
  const frec = { uid: fuid, name, type, state: "loading", length: 0, added: Date.now() };
  const fdel = async function () {
    // delete partial file data
    await fsp.rm(fnam).catch(error => log({ bulk_delete_error: error }));
  }
  node.publish([ 'doc-loading', app_id ], frec);
  // listen on random tcp port for incoming file dump
  const srv = net.createServer(conn => {
    // log({ bulk_conn: conn });
    conn.on('error', (error) => {
      log({ bulk_error: error });
      fdel();
      srv.close();
    });
    conn.on('data', (data) => {
      // log({ bulk_data: data });
      fstr.write(data);
      frec.length += (data.length || data.byteLength);
    })
    conn.on('end', async () => {
      // log({ bulk_end: name, type });
      await file.datasync();
      await fstr.end();
      await file.close();
      // do file analysis
      await doc_embed(frec, fnam).catch(error => {
        log({ embed_error: error, frec });
      });
      srv.close();
    });
  })
  .on('error', error => {
    log({ bulk_listen_error: error });
    fdel();
    srv.close();
  });
  // once tcp server is up, send port back to caller
  return await new Promise(reply => {
    srv.listen(() => {
      // log({ bulk_load: srv.address() });
      // send addr to requestor to complete bulk load
      reply({ host: net_addrs, port: srv.address().port });
    });
  });
}

async function doc_embed(frec, path) {
  const { node, embed, token, app_id, doc_info, cnk_data } = state;
  log({ doc_embed: frec });
  const start = Date.now();

  // store and publish meta-data about doc
  frec.state = "tokenizing";
  await doc_info.put(frec.uid, frec);
  node.publish([ 'doc-loading', app_id ], frec);

  // tokenize and embed
  const chunks = await token.load_path(path, { type: frec.type });
  // log({ chunks });

  // store and publish meta-data about doc
  frec.state = "embedding";
  await doc_info.put(frec.uid, frec);
  node.publish([ 'doc-loading', app_id ], frec);

  // create vector embeddings for each chunk
  // const embed = await import('./lib/embed.mjs);
  const embeds = await embed.vectorize(chunks.map(c => c.pageContent));
  // log({ embeds });

  // annotate chunks with their vector and db indewx (also use for cosine similarity)
  let maxI = -Infinity;
  let minI = Infinity;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vec = chunk.vector = embeds[i];
    const idx = chunk.index = vector_to_index(vec);
    // generate a rough token count for maximizing the embed
    chunk.tokens = chunk.pageContent.replace(/\n/g, ' ').split(' ').length;
    maxI = Math.max(maxI, idx);
    minI = Math.min(minI, idx);
    // store in chunk data indexed by chunk.index
    const { metadata } = chunk;
    const { source, loc } = metadata;
    const { pageNumber, lines } = loc;
    const key = `${chunk.index.toString().padEnd(18, 0)}:${frec.uid}`;
    // log({ key, index: chunk.index, uid: frec.uid });
    cnk_data.put(key, {
      uid: frec_uid,
      text: chunk.pageContent,
      vector: chunk.vector,
      num_tokens: chunk.tokens,
      page: pageNumber,
      page_from: lines.from,
      page_to: lines.to
    });
  }

  // store and publish meta-data about doc
  frec.elapsed = Date.now() - start;
  frec.chunks = chunks.length;
  frec.state = "ready";
  await doc_info.put(frec.uid, frec);
  node.publish([ 'doc-loading', app_id ], frec);
  log({ doc_loaded: frec });
}

// list all docs along with the status (loading, embedding, ready)
async function doc_list(msg, topic, cid) {
  return state.doc_info.list();
}

// delete a document and all of its associated embeddings
async function doc_delete(msg, topic, cid) {
  const { node, app_id, doc_info, cnk_data } = state;
  const { uid } = msg;
  const rec = await doc_info.get(uid);
  const batch = await cnk_data.batch();
  let recs = 0, match = 0;
  for await (const [key] of cnk_data.iter({ values: false })) {
    const [ index, doc_uid ] = key.split(":");
    if (doc_uid === uid) {
      batch.del(key);
      match++;
    }
    recs++;
  }
  await batch.write();
  await doc_info.del(uid);
  log({ del_doc_info: rec, chunks: match });
  node.publish(["doc-delete", app_id], rec);
  return `analyzed ${recs} recs, ${match} matched`;
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
    embed,
    token,
    doc_info,
    cnk_data,
  });

  await setup_node();
  await register_service();
})();