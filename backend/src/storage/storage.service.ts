import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageType: string;
  private readonly localPath: string;
  private readonly baseUrl: string;
  private s3Client: S3Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.storageType = this.configService.get<string>('storage.type', 'local');
    this.localPath = this.configService.get<string>('storage.localPath', './uploads');
    this.baseUrl = this.configService.get<string>('storage.baseUrl', 'http://localhost:3001');
    this.bucket = this.configService.get<string>('aws.bucket');

    if (this.storageType === 's3') {
      this.s3Client = new S3Client({
        region: this.configService.get<string>('aws.region'),
        credentials: {
          accessKeyId: this.configService.get<string>('aws.accessKeyId'),
          secretAccessKey: this.configService.get<string>('aws.secretAccessKey'),
        },
        endpoint: this.configService.get<string>('aws.endpoint'),
      });
    } else {
      this.ensureLocalDir();
    }
  }

  async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (this.storageType === 's3') {
      return this.uploadToS3(key, buffer, mimeType);
    }
    return this.uploadToLocal(key, buffer);
  }

  async uploadFromPath(key: string, filePath: string, mimeType: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    return this.uploadFile(key, buffer, mimeType);
  }

  async deleteFile(key: string): Promise<void> {
    if (!key) return;
    if (this.storageType === 's3') {
      await this.deleteFromS3(key);
    } else {
      await this.deleteFromLocal(key);
    }
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.storageType === 's3') {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      return getSignedUrl(this.s3Client, command, { expiresIn });
    }
    return `${this.baseUrl}/uploads/${key}`;
  }

  getPublicUrl(key: string): string {
    if (this.storageType === 's3') {
      const endpoint = this.configService.get<string>('aws.endpoint');
      if (endpoint) {
        return `${endpoint}/${this.bucket}/${key}`;
      }
      return `https://${this.bucket}.s3.${this.configService.get('aws.region')}.amazonaws.com/${key}`;
    }
    return `${this.baseUrl}/uploads/${key}`;
  }

  getLocalFilePath(key: string): string {
    return path.join(this.localPath, key);
  }

  private async uploadToS3(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await this.s3Client.send(command);
    this.logger.log(`Uploaded to S3: ${key}`);
    return this.getPublicUrl(key);
  }

  private async uploadToLocal(key: string, buffer: Buffer): Promise<string> {
    const fullPath = path.join(this.localPath, key);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, buffer);
    this.logger.log(`Saved locally: ${fullPath}`);
    return this.getPublicUrl(key);
  }

  private async deleteFromS3(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
      await this.s3Client.send(command);
      this.logger.log(`Deleted from S3: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete from S3: ${key}`, error);
    }
  }

  private async deleteFromLocal(key: string): Promise<void> {
    try {
      const fullPath = path.join(this.localPath, key);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        this.logger.log(`Deleted locally: ${fullPath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete local file: ${key}`, error);
    }
  }

  private ensureLocalDir() {
    if (!fs.existsSync(this.localPath)) {
      fs.mkdirSync(this.localPath, { recursive: true });
    }
  }
}
