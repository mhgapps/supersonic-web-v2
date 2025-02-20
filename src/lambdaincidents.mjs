/* index.mjs - ES Module for Node.js 18 Lambda */

import {
    DynamoDBClient,
    PutItemCommand,
    GetItemCommand,
    QueryCommand,
    UpdateItemCommand,
    DeleteItemCommand
  } from "@aws-sdk/client-dynamodb";
  
  const REGION = "us-east-1";
  const INCIDENTS_TABLE = "super-sonic-incidents";
  
  const dynamoDb = new DynamoDBClient({ region: REGION });
  
  export const handler = async (event) => {
    try {
      console.log("DEBUG: Full Event Object:", JSON.stringify(event, null, 2));
  
      const method = event.requestContext?.http?.method || event.httpMethod;
      const rawPath = event.rawPath || event.path || "";
      const pathSegments = rawPath.split("/").filter((seg) => seg.length > 0);
  
      if (method === "POST" && pathSegments[0] === "incidents") {
        return await createIncident(event);
      } else if (method === "GET" && pathSegments[0] === "incidents" && pathSegments.length === 1) {
        return await getAllIncidents(event);
      } else if (method === "GET" && pathSegments[0] === "incidents" && pathSegments.length === 2) {
        const incidentId = pathSegments[1];
        return await getIncidentById(event, incidentId);
      } else if (method === "PUT" && pathSegments[0] === "incidents" && pathSegments.length === 2) {
        const incidentId = pathSegments[1];
        return await updateIncident(event, incidentId);
      } else if (method === "DELETE" && pathSegments[0] === "incidents" && pathSegments.length === 2) {
        const incidentId = pathSegments[1];
        return await deleteIncident(event, incidentId);
      } else {
        return { statusCode: 404, body: JSON.stringify({ error: "Invalid API Route" }) };
      }
    } catch (error) {
      console.error("Lambda Error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message || "Internal Server Error" })
      };
    }
  };
  
  // ======================
  // CREATE INCIDENT (POST)
  // ======================
  async function createIncident(event) {
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing request body." }) };
    }
    const body = JSON.parse(event.body);
    const { tenantId, locationId, incidentId } = body;
  
    if (!tenantId || !locationId || !incidentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "tenantId, locationId, and incidentId are required."
        }),
      };
    }
  
    // Build the item using the exact SK name your table expects:
    const item = {
      tenantId: { S: tenantId },
      "locationId#incidentId": { S: `${locationId}#${incidentId}` },
      incidentType: { S: body.incidentType || "discipline" },
      incidentDescription: { S: body.incidentDescription || "" }
      // Add other fields from your schema as needed
    };
  
    const command = new PutItemCommand({
      TableName: INCIDENTS_TABLE,
      Item: item,
    });
  
    await dynamoDb.send(command);
    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Incident created successfully." }),
    };
  }
  
  // ======================
  // GET ALL INCIDENTS (GET /incidents?tenantId=xxx[&locationId=yyy])
  // ======================
  async function getAllIncidents(event) {
    const tenantId = event.queryStringParameters?.tenantId;
    if (!tenantId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "tenantId is required in query params." })
      };
    }
    const locationId = event.queryStringParameters?.locationId;
  
    let keyCondition = "tenantId = :t";
    let expressionValues = { ":t": { S: tenantId } };
  
    // If user wants only a specific location, do begins_with(locationId#incidentId, locationId)
    if (locationId) {
      keyCondition += " AND begins_with(#sk, :loc)";
      expressionValues[":loc"] = { S: locationId };
    }
  
    const command = new QueryCommand({
      TableName: INCIDENTS_TABLE,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
      ExpressionAttributeNames: {
        "#sk": "locationId#incidentId" // Because we used a # in the attribute name
      }
    });
  
    const response = await dynamoDb.send(command);
    const items = response.Items || [];
  
    const results = items.map((itm) => ({
      tenantId: itm.tenantId.S,
      locationAndIncident: itm["locationId#incidentId"].S,
      incidentType: itm.incidentType?.S,
      incidentDescription: itm.incidentDescription?.S
    }));
  
    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };
  }
  
  // ======================
  // GET SINGLE INCIDENT
  // ======================
  async function getIncidentById(event, incidentId) {
    const tenantId = event.queryStringParameters?.tenantId;
    const locationId = event.queryStringParameters?.locationId;
    if (!tenantId || !locationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "tenantId and locationId are required in query params."
        }),
      };
    }
  
    const skValue = `${locationId}#${incidentId}`;
  
    const command = new GetItemCommand({
      TableName: INCIDENTS_TABLE,
      Key: {
        tenantId: { S: tenantId },
        "locationId#incidentId": { S: skValue }
      },
    });
  
    const response = await dynamoDb.send(command);
    if (!response.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Incident not found." })
      };
    }
  
    const item = response.Item;
    const result = {
      tenantId: item.tenantId.S,
      locationAndIncident: item["locationId#incidentId"].S,
      incidentType: item.incidentType?.S,
      incidentDescription: item.incidentDescription?.S
    };
  
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  }
  
  // ======================
  // UPDATE INCIDENT (PUT)
  // ======================
  async function updateIncident(event, incidentId) {
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing request body." }) };
    }
    const body = JSON.parse(event.body);
    const { tenantId, locationId } = body;
    if (!tenantId || !locationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "tenantId and locationId are required to update." }),
      };
    }
  
    const skValue = `${locationId}#${incidentId}`;
  
    const UpdateExpression = "SET incidentDescription = :desc, incidentType = :itype";
    const ExpressionAttributeValues = {
      ":desc": { S: body.incidentDescription || "" },
      ":itype": { S: body.incidentType || "discipline" }
    };
  
    const command = new UpdateItemCommand({
      TableName: INCIDENTS_TABLE,
      Key: {
        tenantId: { S: tenantId },
        "locationId#incidentId": { S: skValue }
      },
      UpdateExpression,
      ExpressionAttributeValues,
      ReturnValues: "ALL_NEW"
    });
  
    const response = await dynamoDb.send(command);
    const updated = response.Attributes;
  
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Incident updated.",
        updated: {
          incidentDescription: updated.incidentDescription?.S,
          incidentType: updated.incidentType?.S
        }
      })
    };
  }
  
  // ======================
  // DELETE INCIDENT
  // ======================
  async function deleteIncident(event, incidentId) {
    const tenantId = event.queryStringParameters?.tenantId;
    const locationId = event.queryStringParameters?.locationId;
    if (!tenantId || !locationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "tenantId, locationId are required in query params to delete."
        })
      };
    }
  
    const skValue = `${locationId}#${incidentId}`;
  
    const command = new DeleteItemCommand({
      TableName: INCIDENTS_TABLE,
      Key: {
        tenantId: { S: tenantId },
        "locationId#incidentId": { S: skValue }
      }
    });
  
    await dynamoDb.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Incident deleted." })
    };
  }