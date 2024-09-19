import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { htmlToText } from "html-to-text";
import { mmmma } from "../lib/util.js";
import pdf2html from "pdf2html";
import fsp from "fs/promises";

export function clean_text(text) {
  return text
    .replace(/\ +/g, ' ')       // collapse repeating spaces
    .split('\n')
    .map(t => t.trim())         // trim whitespace off lines
    .join('\n')
    .replace(/\n\n+/g, '\n\n'); // collapse 2+ newlines into 2 newlines
}

// our altnerative to langchain's PDFLoader
// ours is based on pdf2html which uses Apache Tika
export class PDFLoader2 {
  constructor(path, opts = {}) {
    this.path = path;
    this.opts = opts;
  }
  
  async load() {
    if (this.opts.legacy) {
      return new PDFLoader(this.path, { parsedItemSeparator: "" }).load();
    }

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

// load html page and conver to text
export class HTMLLoader{
  constructor(path){
      this.path = path;
  }
  async load() {
    const data = await fsp.readFile(this.path);
    const text  = htmlToText(datatoString(),{
      wordwrap: false,
      ignoreImage: true,
      preserveNewlines: true
     });
    return [{ 
      pageContent: text,
      metadata:{
        source: this.path,
        loc:{
          pageNumber: 1,
          lines:{ from: 0, to: 0 }
        }
      }
   }];
  }
}

// our alternative to RecursiveCharacterSplitter
// that attempts to split on paragraph boundaries and
// then group small paragraphs. if a paragraph exceeds
// chunk size, it is split into sentences and then
// regrouped into smaller paragraphs
export class TextParagraphSplitter {
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
          // TODO recover this from sentence against search pages?
          source: docs[0].metadata ? docs[0].metadata.path : 'unknown',
          loc: {
            pageNumber: 0,
            lines: { from: 0, to: 0 }
          }
        }
      }
    });
  }
}

