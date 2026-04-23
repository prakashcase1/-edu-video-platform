import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

export class StorageService {
  private readonly storageType: string;
  private readonly localPath: string;
  private readonly baseUrl: string;
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    this.storageType = process.env.STORAGE_TYPE || 'local';
    this.localPath = process.env.LOCAL_STORAGE_PATH || './uploads';
    this.baseUrl = process.env.STORAGE_BASE_URL || 'http://localhost:3001';
    this.bucket = process.env.AWS_S3_BUCKET;

    if (this.storageType === 's3') {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        endpoint: process.env.AWS_ENDPOINT || undefined,
        // ─── FIX: Add a request timeout so large uploads don't hang forever ──
        // Default is no timeout, which causes silent hangs on slow connections.
        // 10 minutes is generous for even very large video files.
        requestHandler: {
          requestTimeout: 600_000, // 10 minutes in ms
        } as any,
      });
    }
  }

  // ─── FIX: Stream directly from disk instead of loading into RAM ────────────
  // Old: fs.readFileSync(filePath) → Buffer → S3
  //      A 300 MB video would allocate 300 MB of RAM before the upload even starts.
  //      On constrained workers this causes OOM or a silent hang at ~90%.
  // New: fs.createReadStream(filePath) → S3 / local write
  //      Memory usage stays constant regardless of file size.
  // ────────────────────────────────────────────────────────────────────────────
  async uploadFromPath(key: string, filePath: string, mimeType: string): Promise<string> {
    if (this.storageType === 's3') {
      const fileStream = fs.createReadStream(filePath);
      const fileSize = fs.statSync(filePath).size;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileStream,
        ContentType: mimeType,
        ContentLength: fileSize, // Required when streaming — S3 needs to know size upfront
      });

      await this.s3Client.send(command);
      return this.getPublicUrl(key);
    }

    // Local storage: still use buffer copy (files are on same disk, no RAM concern)
    const buffer = fs.readFileSync(filePath);
    return this.uploadBuffer(key, buffer, mimeType);
  }

  async uploadBuffer(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (this.storageType === 's3') {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });
      await this.s3Client.send(command);
      return this.getPublicUrl(key);
    }

    const fullPath = path.join(this.localPath, key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, buffer);
    return this.getPublicUrl(key);
  }

  async downloadToPath(key: string, destPath: string): Promise<string> {
    if (this.storageType === 's3') {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.s3Client.send(command);
      const stream = response.Body as Readable;

      return new Promise((resolve, reject) => {
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const file = fs.createWriteStream(destPath);
        stream.pipe(file);
        file.on('finish', () => { file.close(); resolve(destPath); });
        file.on('error', reject);
      });
    }

    const sourcePath = path.join(this.localPath, key);
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
    return destPath;
  }

  async deleteFile(key: string): Promise<void> {
    if (!key) return;
    if (this.storageType === 's3') {
      await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } else {
      const fullPath = path.join(this.localPath, key);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
  }

  getPublicUrl(key: string): string {
    if (this.storageType === 's3') {
      const endpoint = process.env.AWS_ENDPOINT;
      if (endpoint) return `${endpoint}/${this.bucket}/${key}`;
      return `https://${this.bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    }
    return `${this.baseUrl}/uploads/${key}`;
  }

  getLocalPath(key: string): string {
    return path.join(this.localPath, key);
  }
}