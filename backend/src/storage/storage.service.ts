import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand, NotFound } from '@aws-sdk/client-s3';
import sharp from 'sharp';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: S3Client;
  public bucket!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.client = new S3Client({
      endpoint: `http://${this.config.get<string>('MINIO_ENDPOINT')}`,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('MINIO_ACCESS_KEY') ?? '',
        secretAccessKey: this.config.get<string>('MINIO_SECRET_KEY') ?? '',
      },
    });
    this.bucket = this.config.get<string>('MINIO_BUCKET') ?? 'hazard-photos';
    await this.ensureBucket();
  }

  /** Idempotently create the bucket. Called once from the lifespan. */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      if (err instanceof NotFound || (err as { name?: string }).name === 'NotFound') {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`created bucket ${this.bucket}`);
      } else if ((err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`created bucket ${this.bucket}`);
      } else {
        // Bucket may exist but head failed for other reasons; try create
        // once and ignore "bucket already exists" errors.
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        } catch (innerErr) {
          this.logger.warn(`ensureBucket: ${(innerErr as Error).message}`);
        }
      }
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const stream = res.Body as NodeJS.ReadableStream | undefined;
    if (!stream) throw new Error(`empty body for ${key}`);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`deleteObject ${key} failed: ${(err as Error).message}`);
    }
  }

  /**
   * Build an original + a 400x400 thumbnail, return their object keys.
   * Caller persists the keys on the Photo row.
   */
  async uploadImage(
    content: Buffer,
    filename: string,
    tempToken: string,
  ): Promise<{ originalKey: string; thumbnailKey: string }> {
    const ext = filename.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
    const originalKey = `temp/${tempToken}/${this.randomId()}.${ext}`;
    const thumbnailKey = `temp/${tempToken}/${this.randomId()}_thumb.${ext}`;

    await this.putObject(originalKey, content, ext === 'png' ? 'image/png' : 'image/jpeg');

    const thumb = await sharp(content)
      .resize(400, 400, { fit: 'inside' })
      .toFormat(ext === 'png' ? 'png' : 'jpeg', { quality: 85 })
      .toBuffer();
    await this.putObject(thumbnailKey, thumb, ext === 'png' ? 'image/png' : 'image/jpeg');

    return { originalKey, thumbnailKey };
  }

  private randomId(): string {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
}
