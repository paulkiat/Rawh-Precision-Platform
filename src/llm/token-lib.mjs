import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { htmlToText } from "html-to-text";
import { mmma } from "../lib/util.js";
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
      const pageContent = clean_text(page);
      return {
        pageContent,
        metadata: {
          source: this.path,
          loc: {
            pageNumber: i + 1,
            lines: { from: 1, to: pageContent.split("\n").length }
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
          lines:{ from: 1, to: text.split("\n").length }
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
    this.debug = opts.debug;
    this.embed_min = this.opts.chunkSize;
    this.embed_max = this.opts.chunkSize;
  }

  // group a set of splits (sentences or lines) up to max_embed
  group(segs, join) {
       const { embed_min } = this;
       let cur = { el: [], ln: 0 };
       let out = [ cur ];
       for (let seg of segs) {
         if (cur.ln + seg.length < embed_min) {
             cur.el.push(seg);
             cur.ln += seg.length;
         } else {
             cur = { el: [ seg ], ln: seg.length };
             out.push(cur);
         }
       }
     return out.map(oe => join ? join(oe.el) : oe.el.join(''));
  }

  // split paragraph when embedding embed_max
  splitParagraph(para) {
      const { embed_max } = this;
      if (para.length <= embed_max) {
          return [ para ];
      }
      // attempt to split paragraph into sentences
      // fails for long lists of urls (wikepedia)
      const sentences = para.split(/(?<=\. )/);
      if (sentences.length > 1) {
          return this.group(sentences);
      }
      // split using newlines and grouping
      const lines = para.split(/(?<=\n)/);
      return this.group(lines);
  }

  splitDocuments(docs) {
    const { debug }= this;

    // split pages into paragraphs
    const pages = docs.map(p => p.pageContent.split("\n\n"));

    // turn paragraphs into records, splitting larger
    // paragraphs into sentences or lines as needed
    const recs = pages.map((paras, pageno) => {
        let lineno = 1;
        // does not accurately capture records spanning pages
        return paras.map((para, pidx) => {
          return this.splitParagraph(para).map(para => {
              const lines = para.split("\n");
              const rec = {
                  pageno: pageno.length + 1,
                  line_from: lineno,
                  line_to: lineno + lines.length + 1,
                  para: pidx + 1,
                  text: para,
                  length: para.length
              };
              lineno += lines.length;
              return rec;
          });
        });
    }).flat().flat();
    // console.log(recs.slice(recs.length-10));

    // group paragraphs which can be needed when there are
    // lists that produce one-line and very short text segments
    const grps = this.group(recs, grp => {
        const rec = grp[0];
        for (let nrec of grp.slice(1)) {
             rec.line_to = Math.max(rec.line_to, nrec.line_to);
             rec.para_to = Math.max(rec.para, nrec.para);
             rec.text += "\n\n" + nrec.text;
        }
        return rec;
    });
    console.log(grps.slice(grps.length - 10));

    // debug stats for chunking funnel
    if (debug) {
      const para = pages.flat();
      const stat1 = mmma(para.map(p => p.length));
      console.log({ paras: para.length, ...stat1 });

      const stat2 = mmma(para.map(p => p.text.length));
      console.log({ paras: recs.length, ...stat2 });

      const stat3 = mmma(para.map(p => p.text.length));
      console.log({ paras: grps.length, ...stat3 });
    }


    // remap to expected langchain structure
    // this is sub-optimal for accurate attribution
    return this.opts.raw ? grps : grps.map(rec => {
      return {
        pageContent: rec.text,
        metadata: {
          source: docs[0].metadata ? docs[0].metadata.path : 'unknown',
          loc: {
            pageNumber: rec.pageno,
            lines: { from: rec.line_from, to: rec.line_to }
          }
        }
      }
    });
  }
}

