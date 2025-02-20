require('dotenv').config();

const { PineconeClient } = require('@pinecone-database/pinecone/dist/pinecone-client.cjs');

async function initPinecone() {
  const client = new PineconeClient();
  await client.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENV,
  });
  // Use your index name "ali-reference-library"
  const index = client.Index("ali-reference-library");
  console.log("Pinecone index ready:", index);
}

initPinecone();s