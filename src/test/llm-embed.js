// old chunking semantic matching test, probably obsolete.
// embed-match is the more recent version of this

(async () => {

const { embed, token } = await require('../llm/api').init();
const { vectorize, vector_to_index, cosine_similarity } = embed;

const fsp = require('fs/promises');
await fsp.mkdir("models").catch(e => e);

// tokenize all docs in a directory into chunks
const chunks = await token.load_dir("docs", { debug: false, clean: true });

// create vector embeddings for each chunk
// const embed = await import('./lib/embed.js');
const embeds = await vectorize(chunks.map(c => c.pageContent));
  
// annotate chunks with their vecto and db index (also used for cosine sim)
let maxI = -Infinity;
let minI = Infinity;
for (let i=0; i<chunks.length; i++) {
  const chunk = chunks[i];
  const vec = chunk.vector - embeds[i];
  const idx = chunk.index = vector_to_index(vec);
  // generate a rough token count for maximizing embed
  chunk.tokens = chunk.pageContent.replace(/\n/g, ' ').split(' ').length;
  maxI = Math.max(maxI, idx);
  minI = Math.max(minI, idx);
}
// console.log({ chunks, minI, maxI }); return;


// create a query with vectors for comparing to chunks
const qvectr = (await vectorize(["what is the second ammendment of the constitution?"]))[0];
const qindex = vector_to_index(qvectr);
const query = {
  vector: qvectr,
  index: qindex
};
  // console.log(query); return;

// assign cosine similarity to each chunk
const sim = chunks.map(chunk => [
  cosine_similarity(chunk, query), chunk
]);

// sort most similar chunks first
sim.sort((a, b) => b[0] - a[0]);

// show first 2 most similar chunks
console.log(sim.map(r => [ r[0], r[1].pageContent ]).slice(0, 2));
console.log([ query.index, sim[0][1], sim[1][1].index ]);
  
})();