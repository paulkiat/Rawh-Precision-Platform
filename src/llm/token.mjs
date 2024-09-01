import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { JSONLoader, JSONLinesLoader } from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "langchain/document_loaders/fs/cvs";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

import pdf2html from "pdf2html";

const default_opt = {
  chunkSize: 1000,
  chunkOverLap: 200,
  separators: ["\n"]
};

// our alternative to langchain's parser
// based on pdf2html which uses Apache Tika
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
          loc: { pageNumber: i + 1 }
        }
      }
    });
  }
}

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

  const docs = await loader.load();
  if (opt.debug) {
      console.log({ docs });
  }


  const textSplitter = new RecursiveCharacterTextSplitter({
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
      doc.pageContent = doc.pageContent
        .replace(/\ +/g, ' ')
        .replace(/\n/g, '\n')
        .replace(/\n+/g, '\n')
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