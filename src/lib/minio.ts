import { Client as MinioClient } from 'minio';

const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
const port = Number(process.env.MINIO_PORT || 9000);
const useSSL = false;

export const minio = new MinioClient({
  endPoint: endpoint,
  port,
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});

const BUCKET = process.env.MINIO_BUCKET || 'shr-photos';

export async function ensureBucket() {
  const exists = await minio.bucketExists(BUCKET);
  if (!exists) await minio.makeBucket(BUCKET, 'us-east-1');
}

export { BUCKET };
