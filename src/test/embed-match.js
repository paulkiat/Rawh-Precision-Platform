const { log, env, args } = require("../lib/util");
const llmapis = require("../llm/api");
const { file } = args;

const pdf2html = require('pdf2html');

(async () => {

  const { embed, token } = await llmapis.init();
  const { clean_text } = token;
  const { vectorize, vector_to_index, cosine_similarity } = embed;

  embed.setup();
  const pages = (await pdf2html.pages(file, { text: true })).map(p => clean_text(p));
  const vects = await vectorize(pages);
  const qv = (await vectorize("what is the second number"))[0];
  const query = {
    vector: qv,
    index: vector_to_index(qv)
  };

  const chunk = pages.map((p, i) => {
    const rec = {
      text: clean_text(p),
      vector: vects[i],
      index: vector_to_index(vects[i]),
    };
    rec.coss = cosine_similarity(query, rec);
    return rec;
  });

  chunk.forEach((rec, idx) => {
    console.log([
      `-------------------------[ page ${idx + 1} ]-------------------------`,
      rec.text,
      ''
    ].join(''));
  });

  chunk.forEach((rec, idx) => {
    console.log([
      `[ page ${(idx + 1).toString().padStart(3, ' ')} ]`,
      `    `,
      `${rec.coss.toFixed(6)}`,
      '    ',
      `${Math.abs(rec.index - query.index).toFixed(11)}`
    ].join(''));
  });

  const para = pages.join("\n").split("\n\n");
  console.log({ paras: para.length, sample: para.slice(50, 53,) });

})();