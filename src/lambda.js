// index.js
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand
} = require("@aws-sdk/client-dynamodb");
const { OpenAI } = require("openai");
const { v4: uuidv4 } = require("uuid");

// AWS Clients
const ssm = new SSMClient({ region: "us-east-1" });
const s3 = new S3Client({ region: "us-east-1" });
const dynamoDb = new DynamoDBClient({ region: "us-east-1" });

const CONVERSATIONS_TABLE = "super-sonic-conversations";
const MESSAGES_TABLE = "super-sonic-messages";

const DEFAULT_TENANT_ID = "tenant-1";
const DEFAULT_USER_ID = "user-guest";

// 1. Helper to get the OpenAI API key from SSM
async function getOpenAIKey() {
  const command = new GetParameterCommand({
    Name: "/openai/apiKey",
    WithDecryption: true,
  });
  const response = await ssm.send(command);
  if (!response.Parameter || !response.Parameter.Value) {
    throw new Error("OpenAI API Key not found in SSM Parameter Store");
  }
  return response.Parameter.Value;
}

// 2. Helper to fetch the contents of a single file from S3
async function getPromptFromS3(bucketName, key) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  const response = await s3.send(command);
  const stream = response.Body;
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// 2a. NEW Helper to fetch ALL files from the bucket and concatenate them
async function getAllPromptsFromBucket(bucketName) {
  // We'll look under the "public/" prefix since you mentioned
  // your files are in public/scenarios, public/prompts, etc.
  const prefix = "public/";
  let continuationToken;
  let combinedContent = "";

  try {
    // 1. List all objects in the bucket under the "public/" prefix
    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken
      });
      const listResponse = await s3.send(listCommand);

      // 2. For each object, fetch and concatenate its content
      if (listResponse.Contents) {
        for (const obj of listResponse.Contents) {
          // Skip any "folder" placeholders
          if (obj.Key.endsWith("/")) continue;

          // Optionally filter by extension or folder if desired, e.g.:
          // if (!obj.Key.endsWith(".txt") && !obj.Key.endsWith(".md")) continue;

          console.log(`Fetching content from S3 key: ${obj.Key}`);
          const fileContent = await getPromptFromS3(bucketName, obj.Key);

          // Separate each file’s content with a divider or newline
          combinedContent += `\n\n=== FILE: ${obj.Key} ===\n${fileContent}\n`;
        }
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    return combinedContent.trim();
  } catch (err) {
    console.error("Error listing/reading S3 objects:", err);
    throw err;
  }
}

// 3. Generate a conversation title using OpenAI based on the first user message.
async function generateConversationTitle(userInput) {
  try {
    const openAIKey = await getOpenAIKey();
    const openai = new OpenAI({ apiKey: openAIKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Generate a short, descriptive title (5-7 words) for the following conversation content:",
        },
        { role: "user", content: userInput },
      ],
      max_tokens: 20,
      temperature: 0.5,
    });
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content.trim();
    }
  } catch (error) {
    console.error("Error generating conversation title:", error);
  }
  return `Conversation ${new Date().toISOString()}`;
}

// 4. Store a new conversation in DynamoDB
async function storeConversation(tenantId, userId, title) {
  const conversationId = uuidv4();
  const timestamp = new Date().toISOString();
  const command = new PutItemCommand({
    TableName: CONVERSATIONS_TABLE,
    Item: {
      tenantId: { S: tenantId },
      conversationId: { S: conversationId },
      createdBy: { S: userId },
      createdAt: { S: timestamp },
      title: { S: title },
    },
  });
  await dynamoDb.send(command);
  return conversationId;
}

// 5. Store a message in DynamoDB
async function storeMessage(conversationId, tenantId, role, userId, content) {
  const messageId = uuidv4();
  const timestamp = new Date().toISOString();
  const command = new PutItemCommand({
    TableName: MESSAGES_TABLE,
    Item: {
      conversationId: { S: conversationId },
      messageId: { S: messageId },
      tenantId: { S: tenantId },
      role: { S: role },
      userId: { S: userId || "ALI" },
      content: { S: content },
      timestamp: { S: timestamp },
    },
  });
  await dynamoDb.send(command);
}

// 6. Retrieve conversation history from DynamoDB and sort by timestamp
async function getConversationHistory(conversationId) {
  try {
    const command = new QueryCommand({
      TableName: MESSAGES_TABLE,
      KeyConditionExpression: "conversationId = :cid",
      ExpressionAttributeValues: { ":cid": { S: conversationId } },
      ScanIndexForward: true,
    });
    const response = await dynamoDb.send(command);
    if (!response.Items) {
      console.warn(`No items returned for conversationId: ${conversationId}`);
      return [];
    }
    console.log(`DEBUG: Query returned ${response.Items.length} items for conversationId: ${conversationId}`);
    // Sort items by timestamp (assuming ISO string timestamps)
    const sortedItems = response.Items.sort((a, b) => new Date(a.timestamp.S) - new Date(b.timestamp.S));
    return sortedItems.map(item => ({
      role: item.role.S,
      content: item.content.S,
    }));
  } catch (error) {
    console.error("Error in getConversationHistory:", error);
    throw error;
  }
}

// 7. Retrieve all conversations for a user
async function getConversations(tenantId, userId) {
  try {
    const command = new QueryCommand({
      TableName: CONVERSATIONS_TABLE,
      KeyConditionExpression: "tenantId = :tenantId",
      FilterExpression: "createdBy = :userId",
      ExpressionAttributeValues: {
        ":tenantId": { S: tenantId },
        ":userId": { S: userId },
      },
    });
    const response = await dynamoDb.send(command);
    if (!response.Items) {
      console.warn(`No conversations found for tenantId ${tenantId} and userId ${userId}`);
      return [];
    }
    return response.Items.map(item => ({
      conversationId: item.conversationId.S,
      createdAt: item.createdAt.S,
      title: item.title.S,
    }));
  } catch (error) {
    console.error("Error in getConversations:", error);
    throw error;
  }
}

// 8. Helper to process and clean up the OpenAI response.
function trimTrailingAsterisks(text) {
  return text.replace(/\*+$/, "").trim();
}

function convertRelativeDates(text) {
  const now = new Date();
  if (text.toLowerCase().includes("yesterday")) {
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const formatted = yesterday.toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
    text = text.replace(/yesterday/gi, formatted);
  }
  if (text.toLowerCase().includes("last friday")) {
    const dayOfWeek = now.getDay();
    const daysToSubtract = dayOfWeek >= 5 ? dayOfWeek - 5 : dayOfWeek + 2;
    const lastFriday = new Date();
    lastFriday.setDate(now.getDate() - daysToSubtract);
    const formatted = lastFriday.toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
    text = text.replace(/last friday/gi, formatted);
  }
  return text;
}

function processAliResponse(response) {
  let processed = response.replace("Thank you for providing the time.", "").trim();
  processed = convertRelativeDates(processed);
  if (processed.includes("OPTIONS:")) {
    const parts = processed.split("OPTIONS:");
    const mainMessage = parts[0].trim();
    const optionsPart = parts[1].trim();
    const options = optionsPart.split("|").map(opt => opt.trim());
    return { text: trimTrailingAsterisks(mainMessage), options };
  }
  return { text: trimTrailingAsterisks(processed), options: [] };
}

// 9. Helper to update a conversation title in DynamoDB
async function updateConversationTitle(convId, newTitle) {
  const timestamp = new Date().toISOString();
  const command = new UpdateItemCommand({
    TableName: CONVERSATIONS_TABLE,
    Key: {
      tenantId: { S: DEFAULT_TENANT_ID },
      conversationId: { S: convId }
    },
    UpdateExpression: "SET #t = :newTitle, #u = :timestamp",
    ExpressionAttributeNames: {
      "#t": "title",
      "#u": "updatedAt"
    },
    ExpressionAttributeValues: {
      ":newTitle": { S: newTitle },
      ":timestamp": { S: timestamp }
    }
  });
  await dynamoDb.send(command);
}

// 10. Helper to delete a conversation in DynamoDB
async function deleteConversation(convId) {
  const command = new DeleteItemCommand({
    TableName: CONVERSATIONS_TABLE,
    Key: {
      tenantId: { S: DEFAULT_TENANT_ID },
      conversationId: { S: convId }
    }
  });
  await dynamoDb.send(command);
}

// 11. Main Lambda Handler
exports.handler = async (event) => {
  try {
    console.log("DEBUG: Full Event Object:", JSON.stringify(event, null, 2));
    const clientMethod =
      event.requestContext &&
      event.requestContext.http &&
      event.requestContext.http.method
        ? event.requestContext.http.method
        : event.httpMethod;
    const rawPath = event.rawPath || event.path || "";
    const pathSegments = rawPath.split("/").filter(seg => seg.length > 0);
    const route = pathSegments[0] || "";
    console.log("DEBUG: Extracted route:", route);
    console.log("DEBUG: Client Method:", clientMethod);
    const queryParams = event.queryStringParameters || {};

    // GET /conversations
    if (clientMethod === "GET" && route === "conversations") {
      const tenantId = queryParams.tenantId || DEFAULT_TENANT_ID;
      const userId = queryParams.userId || DEFAULT_USER_ID;
      const conversations = await getConversations(tenantId, userId);
      return {
        statusCode: 200,
        body: JSON.stringify(conversations),
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      };
    }

    // PUT /conversations/{convId} -> Rename Conversation
    if (clientMethod === "PUT" && route === "conversations" && pathSegments.length === 2) {
      if (!event.body) throw new Error("Request body is missing or undefined");
      const requestBody = JSON.parse(event.body);
      const newTitle = requestBody.title;
      if (!newTitle) throw new Error("Missing required field: title.");
      const convId = pathSegments[1];
      await updateConversationTitle(convId, newTitle);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Conversation renamed successfully" }),
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      };
    }

    // DELETE /conversations/{convId} -> Delete Conversation
    if (clientMethod === "DELETE" && route === "conversations" && pathSegments.length === 2) {
      const convId = pathSegments[1];
      await deleteConversation(convId);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Conversation deleted successfully" }),
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      };
    }

    // GET /messages
    if (clientMethod === "GET" && route === "messages") {
      const tenantId = queryParams.tenantId || DEFAULT_TENANT_ID;
      const conversationId = queryParams.conversationId;
      if (!conversationId) {
        throw new Error("Missing conversationId in query parameters.");
      }
      const messages = await getConversationHistory(conversationId);
      return {
        statusCode: 200,
        body: JSON.stringify(messages),
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      };
    }

    // POST /messages
    if (clientMethod === "POST" && route === "messages") {
      if (!event.body) throw new Error("Request body is missing or undefined");
      const requestBody = JSON.parse(event.body);
      const userInput = requestBody.text;
      let convId = requestBody.conversationId;
      const tenantId = requestBody.tenantId || DEFAULT_TENANT_ID;
      const userId = requestBody.userId || DEFAULT_USER_ID;
      if (!userInput) {
        throw new Error("Missing required field: text.");
      }

      // If convId is missing or invalid, create a new conversation
      if (!convId || convId.trim() === "" || convId.trim().toLowerCase() === "null" || convId.trim().toLowerCase() === "undefined") {
        const title = await generateConversationTitle(userInput);
        convId = await storeConversation(tenantId, userId, title);
        console.log("DEBUG: Created new conversation with ID:", convId);
      }

      // Store the user message
      await storeMessage(convId, tenantId, "user", userId, userInput);
      console.log(`DEBUG: Stored user message for conversationId: ${convId}`);

      // Retrieve conversation history
      const history = await getConversationHistory(convId);
      console.log(`DEBUG: Retrieved conversation history: ${JSON.stringify(history)}`);

      // Instead of fetching a single prompt file, read ALL files from the new bucket
      const bucketName = "supersonicadminappdce2353193c847febcddaa04157cf1b0fd-dev";
      let systemPrompt;
      try {
        systemPrompt = await getAllPromptsFromBucket(bucketName);
        console.log("DEBUG: Combined system prompt length:", systemPrompt.length);
      } catch (err) {
        console.error("Error fetching or combining prompts from S3:", err);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Failed to fetch or combine prompts from bucket." }),
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        };
      }

      // Call OpenAI API with the combined system prompt
      let aiResponse;
      try {
        const openAIKey = await getOpenAIKey();
        const openai = new OpenAI({ apiKey: openAIKey });
        const firstResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: userInput }
          ],
          max_tokens: 500,
          temperature: 0.3
        });
        if (!firstResponse.choices || firstResponse.choices.length === 0) {
          throw new Error("No response from OpenAI.");
        }
        aiResponse = firstResponse.choices[0].message.content;
      } catch (error) {
        console.error("OpenAI API error:", error);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "OpenAI API error: " + error.message }),
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        };
      }

      // Store AI response
      await storeMessage(convId, tenantId, "assistant", "ALI", aiResponse);
      console.log(`DEBUG: Stored AI response for conversationId: ${convId}`);

      return {
        statusCode: 200,
        body: JSON.stringify({ conversationId: convId, reply: aiResponse }),
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      };
    }

    // If route not matched
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Invalid API Route" }),
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    };
  } catch (error) {
    console.error("Lambda Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    };
  }
};