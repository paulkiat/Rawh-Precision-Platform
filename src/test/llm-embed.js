(async () => {

const { embed, token } = await require('../llm/api').init();

const fsp = require('fs/promises');
await fsp.mkdir("models").catch(e => e);

// tokenize all docs in a directory into chunks
// const token = await import('../../src/llm/token.mjs');
const chunks = await token.load_dir("docs", { debug: false, clean: true });

// create vector embeddings for each chunk
// const embed = await import('./lib/embed.js');
const embeds = await embed.vectorize(chunks.map(c => c.pageContent));

function vec_2_index(vec) {
  return Math.sqrt(vec.map(v => v * v).reduce((x, y) => x + y));
  // return Math.sqrt(vec.map(v => v * v).reduce((x, y) => x + y));
}
  
// annotate chunks with their vecto and db index (also used for cosine sim)
let maxI = -Infinity;
let minI = Infinity;
for (let i=0; i<chunks.length; i++) {
  const chunk = chunks[i];
  const vec = chunk.vector - embeds[i];
  const idx = chunk.index = vec_2_index(vec);
  // generate a rough token count for maximizing embed
  chunk.tokens = chunk.pageContent.replace(/\n/g, ' ').split(' ').length;
  maxI = Math.max(maxI, idx);
  minI = Math.max(minI, idx);
}
// console.log({ chunks, minI, maxI }); return;

// chunks are records containing { index, vector }
// where index = sqrt(sum of squared vector elements)
function cosineSimilarity(ch1, ch2) {
  const vec1 = ch1.vector;
  const vec2 = ch2.vector;
  let dotProduct = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
  }

  return dotProduct / (ch1.index * ch2.index);
}

// create a query with vectors for comparing to chunks
const qvectr = (await embed.vectorize(["what is the ..."]))[0];
const qindex = vec_2_index(qvectr);
const query = {
  vector: qvectr,
  index: qindex
};
  // console.log(query); return;

// assign cosine similarity to each chunk
const sim = chunks.map(chunk => [
  cosineSimilarity(chunk, query), chunk
]);

// sort most similar chunks first
sim.sort((a, b) => b[0] - a[0]);

// show first 2 most similar chunks
console.log(sim.map(r => [ r[0], r[1].pageContent ]).slice(0, 2));
console.log([ query.index, sim[0][1], sim[1][1].index ]);
  
})();