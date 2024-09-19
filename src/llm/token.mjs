import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { JSONLoader, JSONLinesLoader } from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import{ PDFLoader2, HTMLoader, TextParagraphSplitter, clean_text } from "./tokn-lib.mjs";

const default_opt = {
  chunkSize: 1000,
  chunkSizeMax: 1000,
  chunkOverLap: 200,
  separators: ["\n"]
};

const loaders = {
    "txt": (path) => new TextLoader(path),
    "csv": (path, opt) => new CSVLoader(path, opt),
    // "pdf": (path, opt) => new PDFLoader(path, opt || { parsedItemSeparator: ""}),
    "pdf": (path, opt) => new PDFLoader2(path, opt),
    "html": (path) => new HTMLoader(path),
    "json": (path) => new JSONLoader(path, "text"),
    "jsonl": (path) => new JSONLinesLoader(path),
};

// pass `{ legacy: true }` to use langchain's PDFLoader
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
    new TextParagraphSplitter({
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
    splitDocs.forEach(doc => doc.pageContent = clean_text(doc.pageContent));
  }
  return splitDocs;
}

export default {
  clean_text,
  pdf_to_text(path) {
    return new PDFLoader2(path).load();
  },
  html_to_text(path) {
    return new HTMLoader(path).load();
  },
  text_to_chunks(path) {
    return new TextParagraphSplitter({ raw: true, ...opts }).splitDocuments(docs)
  }
}