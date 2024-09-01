const { log, env, args } = require("../lib/util");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const pdf2html = require('pdf2html');
const fsp = require("fs/promises");
const path = args.file;

if (!(path && path.endsWith(".pdf"))) {
  throw "missing --path pointing to a .pdf file";
}

function clean(text) {
  return text
    .replace()
    .split
    .map
    .join
    .replace
}

(async () => {
  if (args.loader) {
    const loader = new PDFLoader(path, { parsedItemSeperator: "" });
    const out = path.replace("pdf", "loader.txt");
    const doc = await loader.load();
    const data = [];
    for (let page of doc) {
      const pageNo = page.metadata.loc.pageNumber;
      const text = [
        `-------------( ${pageCnt++} | ${pageNo} )-------------`,
        clean(page.pageContent)
      ].join("\n")
      console.log(pageNo, text.length);
      data.push(text);
    }
    await fsp.writeFile(out, data.join("\n"));
  }

  if (args.html) {
      console.log(`----------( HTML )-----------`);
      const html = await pdf2html.html(path);
      console.log(htmnl.length);
      await fsp.writeFile(out, html);
  }

  if (args.text) {
      const out = path.replace(".pdf", ".txt");
      console.log(`----------( TEXT )-----------`);
      const text = await pdf2html.text(path);
      console.log(html.length);
      await fsp.writeFile(out, text);
  }

  if (args.hpages) {
      console.log(`----------( PAGES )-----------`);
      const htmlPages = await pdf2html.pages(path);
      console.log(htmlPages.length);
  }

  if (args.pages || args.tpages) {
      const out = path.replace(".pdf", ".pages.txt");
      console.log(`----------( TEXT PAGES )-----------`);
      const options = { text: true };
      const textPages = await pdf2html.text(path, options);
      console.log(textPages.length);
      await fsp.writeFile(out, textPages.map((page, i) => {
        return [
            `-------------( page ${i + 1} )---------------`,
             clean(page)
        ].join("\n")
      }).join("\n"));
    }
})();