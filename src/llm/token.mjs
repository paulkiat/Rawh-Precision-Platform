import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { JSONLoader, JSONLinesLoader } from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "langchain/document_loaders/fs/cvs";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { mmma } from '../lib/util';

import pdf2html from "pdf2html";

const default_opt = {
  chunkSize: 1000,
  chunkOverLap: 200,
  separators: ["\n"]
};

// our alternative to langchain's PDFLoader
// ours is based on pdf2html which uses Apache Tika
class PDF_2_TEXT {
  constructor(path) {
    this.path = path;
  }
  
  async load() {
    const pages = await pdf2html.pages(this.path, { text: true });

    return pages.map((page, i) => {
      return {
        pageContent: clean_text(page),
        metadata: {
          source: this.path,
          loc: {
            pageNumber: i + 1,
            lines: { from: 0, to: 0 }
          }
        }
      }
    });
  }
}

// our alternative to RecursiveCharacterSplitter
// that attempts to split on paragraph boundaries and
// then group small paragraphs. if a paragraph exceeds
// chunk size, it is split into sentences and then
// regrouped into smaller paragraphs
class Text_2_ParaChunks {
  constructor(opts = {}) {
    this.opts = opts;
  }

  splitDocuments(docs) {
    const max_embed = this.opts.chunkSize ?? default_opt.chunkSize;
    const pages = docs.map(p => p.pageContent);
    const debug = this.opts.debug;

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

    // remap to expected langchain structure
    return this.opts.raw ? chunks : chunks.map(text => {
      return {
        pageContent: text,
        metadata: {
          source: docs[0].metadata.path,
          // recover this from sentence against search pages?
          loc: {
            pageNumber: 0,
            lines: { from: 0, to: 0 }
          }
        }
      }
    });
  }
}

export default {
  clean_text,
  pdf_to_text(path) {
    return new PDF_2_TEXT(path).load();
  },
  text_to_chunks(docs, opts = {}) {
    return new Text_2_ParaChunks({ raw: true, ...opts }).splitDocuments(docs)
  }
};

const loaders = {
    "txt": (path) => new TextLoader(path),
    "csv": (path, opt) => new CSVLoader(path, opt),
    // "pdf": (path, opt) => new PDFLoader(path, opt || { parsedItemSeparator: ""}),
    "pdf": (path) => new PDF_2_TEXT(path),
    "json": (path) => new JSONLoader(path, "text"),
    "jsonl": (path) => new JSONLinesLoader(path),
};

export function clean_text(text) {
  return text
    .replace(/\ +/g, ' ')       // collapse repeating spaces
    .split('\n')
    .map(t => t.trim())         // trim whitespace off lines
    .join('\n')
    .replace(/\n\n+/g, '\n\n'); // collapse 2+ newlines into 2 newlines
}

export async function load_path(path, opts = {}) {
  const opt = Object.assign({}, default_opt, opts);
  const type = opt.type || path.split('.').pop();
  const loader = loaders[type];

  if (!loader) {
    throw "invalid or missing file type";
  }

  return split(loader(path), opt);
}

export async function split(loader, opts = {}) {
  const opt = Object.assign({}, default_opt, opts);

  // docs are usually pages (when importing pdfs)
  const docs = await loader.load();
  if (opt.debug) {
      console.log({ docs, opts });
  }


  const textSplitter = opt.paraChunks ? 
    new Text_2_ParaChunks({
      chunkSize: opt.chunkSize ?? 1000,
      debug: opt_debug
    }) :
    new RecursiveCharacterTextSplitter({
      chunkOverLap: opt.chunkOverlap ?? 200,
      chunkSize: opt.chunkSize ?? 1000,
      separators: opt.separators
    });

  const splitDocs = await textSplitter.splitDocuments(docs);
  
  if (opt.clean) {
    for (let doc of splitDocs) {
      doc.pageContent = doc.pageContent
        .replace(/\ +/g, ' ')
        .replace(/\n/g, '\n')
        .replace(/\n+/g, '\n')
    }
  }

  if (opt.debug) {
    console.log({ splitDocs });


    const sources = { };
    const pages = { };
    const trak = { sources: 0, pages: 0 };

    for (let doc of splitDocs) {
      doc.pageContent = clean_text(doc.pageContent);
      console.log('-------------------------------------------------------');
      console.log(doc.pageContent);
      console.log('. . . . . . . . . . . . . . . . . . . . . . . . . . . .');
      console.log(doc.metadata);
      const { source, pdf, loc } = doc.metadata;
      if (!sources[source]) {
        sources[source] = source;
        trak.sources++;
      }
      const pageid = `${source}-${loc.pageNumber}`;
      if (!pages[pageid]) {
        pages[pageid] = pageid;
        trak.pages++;
      }

    }

    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    console.log({ docs: docs.length, splitDocs: splitDocs.length, trak });
  }

  return splitDocs;
}