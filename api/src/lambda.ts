// AWS Lambda entry point for the API (behind API Gateway) via serverless-express.
import serverlessExpress from '@codegenie/serverless-express';
import { composeFromEnv } from './bootstrap';

const { app } = composeFromEnv();

export const handler = serverlessExpress({ app });
