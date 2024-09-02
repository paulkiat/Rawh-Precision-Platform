// TEST PLAYGROUND

const { args, mmma } = require("../lib/util");
const proxy_host = args['proxy-host'] || 'localhost';
const proxy_port = args['proxy-port'] || '6000';
const net = require('../lib/net');
const node = args.node ? net.node(proxy_host, proxy_port) : undefined;

const llmapis = require("../llm/api");
const { file, model } = args;

const pdf2html = require('pdf2html');
const max_embed = 512;

(async () => {
  const start = Date.now();

  const { embed, token } = await llmapis.init();
  const { clean_text } = token;
  const { vectorize, vector_to_index, cosine_similarity } = embed;

  // provide cmd line option `--node` to use network embed services
  const to_vector = node ? async function (chunks) {
    chunks = Array.isArray(chunks) ? chunks : [chunks];
    // return node.promise.call('', "embed/org", { text: chunks });
    // parallelize across all embed services
    const p = Promise.all(chunks.map(c => node.promise.call('', "embed/org", { text: [c] })));
    return (await p).flat();
  } : vectorize;

  embed.setup({ modelName: model });
  const pages = (await pdf2html.pages(file, { text: true })).map(p => clean_text(p));

  // explore chunking into paragraphs
  const para = pages.map(p => clean_text(p)).join("\n").split("\n\n");
  const stat = mmma(pages.map(p => p.length));
  // const mid = para[Math.round(para.length/2)];
  console.log({ paras: para.length, ...stat });

  // switch out strategies here eg: use groupings of paragraphs instead of pages
  // const chunk = pages
  const ppre = para.map(p => p.length <= max_embed ? [p] : p.split(/(?=\. )/)).flat();
  const chunks = [''];
  for (let p of ppre) {
    const cc = chunks[chunks.length - 1];
    if (cc.length + p.length <= max_embed) {
        chunks[chunks.length - 1] += "\n\n" + p;
    } else {
        chunks.push(p);
    }
  }
  console.log({ chunks: chunks.length, ...mmma(chunks.map(c => c.length)) });

  const vects = await to_vector(pages);
  const qv = (await to_vector("what is the second number"))[0];
  const query = {
    vector: qv,
    index: vector_to_index(qv)
  };

  const embeds = chunks.map((p, i) => {
    const rec = {
      order: i,
      text: clean_text(p),
      vector: vects[i],
      index: vector_to_index(vects[i]),
    };
    rec.coss = Math.abs(cosine_similarity(query, rec));
    return rec;
  });

  if (args.debug)
  embeds.forEach((rec, idx) => {
    console.log([
      `-------------------------[ page ${idx + 1} ]-------------------------`,
      rec.text,
      ''
    ].join(''));
  });
  
  // add cosine match ranking
  const rank_coss = embeds.slice();
  rank_coss.sort((a, b) => b.coss - a.coss).forEach((rec, idx) => {
    rec.rank_coss = idx;
  });

  // add cosine match ranking
  const rank_indx = embeds.slice();
  rank_indx.sort((a, b) => b.index - a.index).forEach((rec, idx) => {
    rec.rank_index = idx;
  });

  embeds.forEach((rec, idx) => {
    console.log([
      `[ embed ${(idx + 1).toString().padStart(3, ' ')} ]`,
      `[ size ${(rec.text.length).toString().padStart(4, ' ')} ]`,
      `    `,
      `${rec.coss.toFixed(6)} | ${rec.rank_coss.toString().padStart(3, ' ')}`,
      '    ',
      `${Math.abs(rec.index - query.index).toFixed(11)}`,
      ` | ${rec.rank_index.toString().padStart(3, ' ')}`,
      rec.rank_coss === 0 ? 'C' : '',
      rec.rank_indx === 0 ? 'I' : '',
    ].join(''));
  });

  console.log({
    match_coss: chunk[rank_coss[0].order].text,
    match_index: chunk[rank_indx[0].order].text,
  });

  console.log({ runtime: Date.now() - start });
  
  process.exit(0);
})();