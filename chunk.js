import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

async function loadAndChunkDocs() {
  // Load documents from the "./docs" folder
  const loader = new DirectoryLoader("./docs", {
    ".txt": (path) => new TextLoader(path),
  });
  const rawDocs = await loader.load();
  console.log("Loaded Documents:", rawDocs);

  // Initialize the text splitter with desired chunk size and overlap
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });

  // Split all loaded documents into chunks
  const chunkedDocs = await splitter.splitDocuments(rawDocs);
  console.log("Chunked Documents:", chunkedDocs);
}

loadAndChunkDocs();