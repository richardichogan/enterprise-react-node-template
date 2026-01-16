/**
 * List documents in blob storage
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

const credential = new StorageSharedKeyCredential(ACCOUNT_NAME, ACCOUNT_KEY);
const blobServiceClient = new BlobServiceClient(
  `https://${ACCOUNT_NAME}.blob.core.windows.net`,
  credential
);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

console.log(`📦 Listing documents in: ${CONTAINER_NAME}\n`);

let count = 0;
for await (const blob of containerClient.listBlobsFlat()) {
  count++;
  console.log(`${count}. ${blob.name} (${(blob.properties.contentLength / 1024).toFixed(1)} KB)`);
}

console.log(`\nTotal: ${count} document(s)`);
