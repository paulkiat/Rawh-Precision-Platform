// document storage, retrieval, and query library based on level-db (lib/store)
// storage also chunks and creates embeddings for each document with some level
// of scoping, which is usually by application id

const net = require('net');
const fsp = require('fs/promises');
const util = require('../lib/util');
const state = require('./service').init();
const log = util.prelog('doc');
const debug = util.args.debug;

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
  node.handle([ "docs-query", app_id ], docs_query);
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
async function doc_load(msg = {}) {
  log({ doc_load: msg });
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
  const { node, embed, token, app_id, doc_info, cnk_data, llama_token } = state;
  log({ doc_embed: frec });
  const start = Date.now();

  // store and publish meta-data about doc
  frec.state = "tokenizing";
  await doc_info.put(frec.uid, frec);
  node.publish([ 'doc-loading', app_id ], frec);

  // tokenize and embed
  const chunks = await token.load_path(path, { type: frec.type });
  // log({ chunks: chunks.length });

  // store and publish meta-data about doc
  frec.state = "embedding";
  await doc_info.put(frec.uid, frec);
  node.publish([ 'doc-loading', app_id ], frec);

  // create vector embeddings for each chunk
  // const embed = await import('./lib/embed.mjs);
  const embeds = await embed.vectorize(chunks.map(c => c.pageContent));
  // log({ embeds: embeds.length });

  // annotate chunks with their vector and db indewx (also use for cosine similarity)
  // TODO: store prev/next pointers for gathering better contexts
  let maxI = -Infinity;
  let minI = Infinity;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vec = chunk.vector = embeds[i];
    const idx = chunk.index = vector_to_index(vec);
    // generate a rough token count for maximizing the embed
    // chunk.tokens = chunk.pageContent.replace(/\n/g, ' ').split(' ').length;
    chunk.tokens = llama_token.encode(chunk.pageContent).length;
    maxI = Math.max(maxI, idx);
    minI = Math.min(minI, idx);
    // store in chunk data indexed by chunk.index
    const { metadata } = chunk;
    const { source, loc } = metadata;
    const { pageNumber, lines } = loc;
    const key = `${chunk.index.toString().padEnd(18, 0)}:${frec.uid}`;
    // log({ key, index: chunk.index, uid: frec.uid });
    cnk_data.put(key, {
      uid: frec.uid,
      vector: chunk.vector,
      text: chunk.pageContent,
      index: chunk.index,
      tokens: chunk.tokens,
      page: pageNumber,
      line_from: lines.from,
      line_to: lines.to
    });
    if (debug) {
        console.log(`---[ ${pageNumber} ]---[ ${lines.from}:${lines.to} ]---[ ${frec.uid} ]---`);
        console.log(chunk.pageContent);
    }
  }
  if (debug) {
      console.log("------------------------------");
  }

  // store and publish meta-data about doc
  frec.elapsed = Date.now() - start;
  frec.chunks = chunks.length;
  frec.state = "ready";
  await doc_info.put(frec.uid, frec);
  node.publish([ 'doc-loading', app_id ], frec);
  // log({ doc_loaded: frec });
}

// list all docs along with the status (loading, embedding, ready)
async function doc_list(msg) {
  return state.doc_info.list();
}

// delete a document and all of its associated embeddings
async function doc_delete(msg) {
  const { node, app_id, doc_info, cnk_data } = state;
  const { uid } = msg;
  // delete matching meta-data and embeds
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
  // delete file artifact
  const fdir = `${state.data_dir}/docs`;
  const fnam = `${fdir}/${uid}`;
  await fsp.unlink(fnam);
  // log({ del_doc_info: rec, chunks: match });
  node.publish([ "doc-delete", app_id ], rec);
  return `analyzed ${recs} recs, ${match} matched`;
}

// given a query, get matching embed chunks from loaded docs
async function docs_query(msg) {
  const { node, embed, cnk_data } = state;
  const { query, max_tokens, min_match, llm, topic } = msg;
  const vector = (await embed.vectorize([ query ]))[0];
  const index = vector_to_index(vector);
  const key = `${index.toString().padEnd(18, 0)}`;
  log({ docs_query: msg });

  const iter_lt = {
    iter: cnk_data.iter({ lt: key }),
    coss: 1,
    pos: -1,
    add: -1
  };
  const iter_gt = {
    iter: cnk_data.iter({ gte: key }),
    coss: 1,
    pos: 1,
    add: 1
  };
  iter_lt.next = iter_gt;
  iter_gt.next = iter_lt;

  const found = [];
  const search = [ iter_gt, iter_lt ];
  const max_t = max_tokens || 3500;
  let tokens = 0;
  let which = 0;

    for (let i=0; i<500; i++) {
      const iter = search[which];
      const next = await iter.iter.next();

      if (!next) {
        // log({ iter_ended: iter.add });
        // current iterator ehausted
        iter.dead = true;
        which = 1 - which;
        // both iterators exhausted
        if (search[which].dead) {
          log("iterators exhaausted", i);
          break;
        }
        continue;
      }
      const [ key, rec ] = next;
      const coss = cosine_similarity({ vector, index }, {
        vector: rec.vector,
        index: rec.index
      });

      found.push({ i: iter.pos, coss, text: rec.text, tokens: rec.tokens, key, page: rec.page });
      iter.pos += iter.add;
      iter.coss = coss;
      tokens += rec.tokens;

      if (coss < iter.next.coss && !iter.next.dead) {
        which = 1 - which;
      }
      if (tokens >= max_t * 2) {
        break;
      }
    }

    // close iterators to prevent mem leak
    search.forEach(iter => iter.iter.close());

    // sort by relevance, limit to top 10
    found.sort((a, b) => { return b.coss - a.coss });
    
  // reduce to max chunks that will fit in embed window and
  // limit to chunks within 75% of max cosine_similarity value
  const mmatch = min_match || 0.75;
    let tleft = max_t;
    let max_coss = 0;
    let cnk_used = 0;
    const embeds = found.map(r => {
      max_coss = Math.max(max_coss, r.coss);
      tleft = tleft - r.tokens;
      const ok = tleft >= 0 && (r.coss > max_coss * mmatch || cnk_used < 4);
      cnk_used += ok ? 1 : 0;
      // log({ t: r.tokens, use: ok, tleft });
      return ok ? r: undefined
    }).filter(c => c);

    // do a little debug reporting on what we found
    // let report;
    // console.log(report = embeds.map(r => {
    //   return {
    //     dist: r.i,
    //     coss: r.coss,
    //     toks: r.tokens
    //   };
    // }), report.reduce((acc, r) => acc + r.toks, 0);

    // time to consult the llm
    if (llm) {
      const embed = [
        "Based on the following context, succinctly answer the question at the end.\n",
        "Prepend the Paragraph ID(s) used for the answer in [brackers]\n",
        // "using only the text available in the fragments, Do not improvise.\n",
        "If the answer is not found in the provided context, reply that you do not ",
        "have a document related to the question,\n",
        "-----\n",
        ...embeds.map((r,i) => `\n<P id='E${i}-PS${r.page}">\n${r.text}\n</P>`),
        `\nQuestion: ${query}\n\nAnswer:`
      ].join('');
      log({
        found: found.length,
        using: embeds.length,
        text: embed.length,
        tokens: embed.reduce((acc, r) => acc + r.tokens, 0)
      });
      const start = Date.now();
      // const once = "llm-query/org";
      const answer = await node.promise
          .call('', llm, { query: embed, topic })
          .catch(error => {
            log({ llm_error: error });
            return { error: "llm service not responding" };
        });
      log(answer, { time: Date.now() - start });
      return answer;
    }

    return found;
}

(async () => {
  const { embed, token } = await require('../llm/api').init();

  const store = await require('../lib/store').open(`${state.data_dir}/embed`);
  const doc_info = store.sub('docs'); // doc meta-data
  const cnk_data = store.sub('chunks'); // chunked embed data
  const llama_token = (await import('llama-tokenizer-js')).default;
  // console.log(tokenizer.encode("this is a fine day to code"));

  Object.assign(state, {
    store,
    embed,
    token,
    doc_info,
    cnk_data,
    llama_token
  });

  await setup_node();
  await register_service();
})();