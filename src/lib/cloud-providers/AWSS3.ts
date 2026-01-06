import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { ICloudStorage, CloudFile, CloudFileInfo } from './types';

export class AWSS3Storage implements ICloudStorage {
  private client: S3Client | null = null;
  private bucket: string;
  private region: string;

  constructor(config: { bucket: string; region: string; accessKeyId: string; secretAccessKey: string }) {
    this.bucket = config.bucket;
    this.region = config.region;

    try {
      this.client = new S3Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
    } catch (error) {
      console.error('AWS S3 initialization failed:', error);
      throw new Error('AWS S3 初始化失败');
    }
  }

  async upload(file: CloudFile): Promise<CloudFileInfo> {
    if (!this.client) throw new Error('S3 客户端未初始化');

    try {
      const fileName = `${Date.now()}-${file.name}`;
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
        Body: file.content,
        ContentType: 'text/markdown',
      });

      await this.client.send(command);

      // 生成预签名 URL
      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${fileName}`;

      return {
        id: fileName,
        name: file.name,
        lastModified: new Date().toISOString(),
        size: file.content.length,
        url,
      };
    } catch (error: any) {
      console.error('AWS S3 upload failed:', error);
      throw new Error(`上传失败: ${error.message || '未知错误'}`);
    }
  }

  async download(fileId: string): Promise<string> {
    if (!this.client) throw new Error('S3 客户端未初始化');

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileId,
      });

      const response = await this.client.send(command);
      const chunks: Uint8Array[] = [];

      // @ts-ignore - Body is a ReadableStream
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      return buffer.toString('utf-8');
    } catch (error: any) {
      console.error('AWS S3 download failed:', error);
      throw new Error(`下载失败: ${error.message || '未知错误'}`);
    }
  }

  async listFiles(): Promise<CloudFileInfo[]> {
    if (!this.client) throw new Error('S3 客户端未初始化');

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 100,
      });

      const response = await this.client.send(command);

      if (!response.Contents) return [];

      return response.Contents.map((obj) => ({
        id: obj.Key!,
        name: obj.Key!,
        lastModified: obj.LastModified?.toISOString() || new Date().toISOString(),
        size: obj.Size || 0,
      }));
    } catch (error: any) {
      console.error('AWS S3 list files failed:', error);
      throw new Error(`列出文件失败: ${error.message || '未知错误'}`);
    }
  }

  async delete(fileId: string): Promise<void> {
    if (!this.client) throw new Error('S3 客户端未初始化');

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileId,
      });

      await this.client.send(command);
    } catch (error: any) {
      console.error('AWS S3 delete failed:', error);
      throw new Error(`删除失败: ${error.message || '未知错误'}`);
    }
  }

  async update(fileId: string, content: string): Promise<CloudFileInfo> {
    if (!this.client) throw new Error('S3 客户端未初始化');

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileId,
        Body: content,
        ContentType: 'text/markdown',
      });

      await this.client.send(command);

      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${fileId}`;

      return {
        id: fileId,
        name: fileId,
        lastModified: new Date().toISOString(),
        size: content.length,
        url,
      };
    } catch (error: any) {
      console.error('AWS S3 update failed:', error);
      throw new Error(`更新失败: ${error.message || '未知错误'}`);
    }
  }
}
