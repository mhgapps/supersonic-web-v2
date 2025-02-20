import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";

async function loadDocs() {
  const loader = new DirectoryLoader("./docs", {
    ".txt": (path) => new TextLoader(path),
  });
  const rawDocs = await loader.load();
  console.log("Loaded Documents:", rawDocs);
}

loadDocs();