const { log, env, args } = require("../lib/util");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const pdf2html = require('pdf2html');
const fsp = require("fs/promises");
const path = args.file;
const token = import('../llm/token.mjs');

if (!(path && path.endsWith(".pdf"))) {
  throw "missing --path pointing to a .pdf file";
}

(async () => {
  const { clean_text } = await token;

  if (args.loader) {
    // langchains's default loader / parser, which is not so great
    const loader = new PDFLoader(path, { parsedItemSeperator: "" });
    const out = path.replace("pdf", "loader.txt");
    const doc = await loader.load();
    const data = [];
    for (let page of doc) {
      const pageNo = page.metadata.loc.pageNumber;
      const text = args.debug ? [
        `-------------( ${pageCnt++} | ${pageNo} )-------------`,
        clean_text(page.pageContent)
      ].join("\n") : clean_text(page.pageContent)
      console.log(pageNo, text.length);
      data.push(text);
    }
    await fsp.writeFile(out, data.join("\n"));
  }

  if (args.text) {
      // appends an index, which we don't want
      const out = path.replace(".pdf", ".txt");
      console.log(`----------( TEXT )-----------`);
      const text = await pdf2html.text(path);
      console.log(html.length);
      await fsp.writeFile(out, clean_text(text));
  }

  if (args.pages || args.tpages) {
      // better since it omits the index
      const out = path.replace(".pdf", ".pages.txt");
      const options = { text: true };
      const textPages = await pdf2html.text(path, { text: true });
      console.log(textPages.length);
      await fsp.writeFile(out, textPages.map((page, i) => {
        return args.debug ? [
            `-------------( page ${i + 1} )---------------`,
             clean_text(page)
        ].join("\n") : clean_text(page)
      }).join("\n"));
  }

  if (args.html) {
      console.log(`-----------( HTML )-----------`);
      const html = await pdf2html.html(path);
      console.log(html.length);
      await fsp.writeFile(out, html);
  }

  if (args.hpages) {
      console.log(`-----------( HTML PAGES )-----------`);
      const htmlPages = await pdf2html.pages(path);
      console.log(htmlPages.length);
  }
  
})();