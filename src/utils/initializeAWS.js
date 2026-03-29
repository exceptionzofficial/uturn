const { 
  CreateBucketCommand, 
  HeadBucketCommand 
} = require("@aws-sdk/client-s3");
const { 
  CreateTableCommand, 
  DescribeTableCommand 
} = require("@aws-sdk/client-dynamodb");
const { s3Client, dynamoClient } = require("../config/awsConfig");
require("dotenv").config();

const INITIALIZE_AWS = async () => {
  console.log("Starting AWS Resource Initialization...");

  // 1. Initializing S3 Bucket
  const bucketName = process.env.S3_BUCKET_NAME;
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`[S3] Bucket "${bucketName}" already exists.`);
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      console.log(`[S3] Creating Bucket "${bucketName}"...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`[S3] Bucket "${bucketName}" created successfully.`);
    } else {
      console.error("[S3] Error checking/creating bucket:", err.message);
    }
  }

  // 2. Initializing DynamoDB Tables
  const tables = [
    {
      TableName: process.env.DYNAMODB_TABLE_DRIVERS,
      KeySchema: [{ AttributeName: "driverId", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "driverId", AttributeType: "S" }],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    },
    {
      TableName: process.env.DYNAMODB_TABLE_DOCUMENTS,
      KeySchema: [
        { AttributeName: "documentId", KeyType: "HASH" },
        { AttributeName: "driverId", KeyType: "RANGE" }
      ],
      AttributeDefinitions: [
        { AttributeName: "documentId", AttributeType: "S" },
        { AttributeName: "driverId", AttributeType: "S" }
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    },
    {
      TableName: process.env.DYNAMODB_TABLE_TRIPS,
      KeySchema: [{ AttributeName: "tripId", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "tripId", AttributeType: "S" }],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    },
    {
      TableName: process.env.DYNAMODB_TABLE_LOGS,
      KeySchema: [
        { AttributeName: "logId", KeyType: "HASH" },
        { AttributeName: "driverId", KeyType: "RANGE" }
      ],
      AttributeDefinitions: [
        { AttributeName: "logId", AttributeType: "S" },
        { AttributeName: "driverId", AttributeType: "S" }
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    },
  ];

  for (const table of tables) {
    try {
      await dynamoClient.send(new DescribeTableCommand({ TableName: table.TableName }));
      console.log(`[DynamoDB] Table "${table.TableName}" already exists.`);
    } catch (err) {
      if (err.name === "ResourceNotFoundException") {
        console.log(`[DynamoDB] Creating Table "${table.TableName}"...`);
        await dynamoClient.send(new CreateTableCommand(table));
        console.log(`[DynamoDB] Table "${table.TableName}" creation initiated.`);
      } else {
        console.error(`[DynamoDB] Error checking/creating table "${table.TableName}":`, err.message);
      }
    }
  }

  console.log("AWS Resource Initialization Check Complete.");
};

module.exports = INITIALIZE_AWS;
