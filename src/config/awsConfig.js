const { S3Client } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { SNSClient } = require("@aws-sdk/client-sns");
require("dotenv").config();

const config = {
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

const s3Client = new S3Client(config);
const dynamoClient = new DynamoDBClient(config);
const snsClient = new SNSClient(config);

module.exports = {
  s3Client,
  dynamoClient,
  snsClient,
};
