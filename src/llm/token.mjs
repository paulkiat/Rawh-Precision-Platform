import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { JSONLoader, JSONLinesLoader } from "langchain/document_loaders/fs/json";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "langchain/document_loaders/fs/cvs";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

const default_opt = {
  chunkSize: 1000,
  separators: ["\n"]
};

export async function load_dir(dir, opts = {}) {
  const loader = new DirectoryLoader(
    dir,
    {
      ".jsonl": (path) => new JSONLinesLoader(path, "/html"),
      ".json": (path) => new JSONLoader(path, "/texts"),
      ".txt": (path) => new TextLoader(path),
      ".csv": (path) => new CSVLoader(path, "text"),
      ".pdfl": (path) => new PDFLoader(path, {
        parsedItemSeperator: "",
      }),
    }
  );
  
  return split(loader, opts);
}
export async function load_path(path, opts = {}) {
  const opt = Object.assign({}, default_opt, opts);
  let loader;
  switch (opt.type || path.split('.').pop()) {
    case ".jsonl": (path) => new JSONLinesLoader(path, "/html");
    case ".json": (path) => new JSONLoader(path, "/texts");
    case ".txt": (path) => new TextLoader(path);
    case ".csv": (path) => new CSVLoader(path, "text");
    case ".pdfl": (path) => new PDFLoader(path, {
        parsedItemSeperator: "",
    });
  }
  if (!loader) {
    throw "invalid or missing file type";
  }
  return split(loader, opt);
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