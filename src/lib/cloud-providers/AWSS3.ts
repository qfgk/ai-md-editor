import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { ICloudStorage, CloudFile, CloudFileInfo } from './types';

export class AWSS3Storage implements ICloudStorage {
  private client: S3Client | null = null;
  private bucket: string;
  private region: string;
  private path: string;
  private imagePath: string;
  private videoPath: string;

  constructor(config: { bucket: string; region: string; accessKeyId: string; secretAccessKey: string; path?: string; imagePath?: string; videoPath?: string }) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.path = config.path || '';
    this.imagePath = config.imagePath || 'images/';
    this.videoPath = config.videoPath || 'videos/';

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
      const pathPrefix = this.path ? this.path.replace(/\/$/, '') + '/' : '';
      const fileName = `${pathPrefix}${Date.now()}-${file.name}`;
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

  async uploadBinary(file: File | Blob, filename: string, contentType?: string): Promise<string> {
    if (!this.client) throw new Error('S3 客户端未初始化');

    try {
      // Determine path prefix based on content type
      let pathPrefix = '';
      if (contentType?.startsWith('image/')) {
        pathPrefix = this.imagePath ? this.imagePath.replace(/\/$/, '') + '/' : '';
      } else if (contentType?.startsWith('video/')) {
        pathPrefix = this.videoPath ? this.videoPath.replace(/\/$/, '') + '/' : '';
      } else {
        pathPrefix = this.imagePath ? this.imagePath.replace(/\/$/, '') + '/' : '';
      }

      const fileName = `${pathPrefix}${filename}`;

      // Convert File/Blob to ArrayBuffer for browser compatibility
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
        Body: uint8Array,
        ContentType: contentType || 'application/octet-stream',
      });

      await this.client.send(command);

      // 生成访问 URL
      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${fileName}`;

      return url;
    } catch (error: any) {
      console.error('AWS S3 binary upload failed:', error);
      throw new Error(`二进制文件上传失败: ${error.message || '未知错误'}`);
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
      const pathPrefix = this.path ? this.path.replace(/\/$/, '') + '/' : '';
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: pathPrefix || undefined,
        MaxKeys: 100,
      });

      const response = await this.client.send(command);

      if (!response.Contents) return [];

      let files = response.Contents.map((obj) => ({
        id: obj.Key!,
        name: obj.Key!,
        lastModified: obj.LastModified?.toISOString() || new Date().toISOString(),
        size: obj.Size || 0,
      }));

      // 过滤出当前路径下的文件（不包括子目录）
      if (pathPrefix) {
        files = files.filter((obj) => {
          const relativePath = obj.id.substring(pathPrefix.length);
          return !relativePath.includes('/');
        }).map((obj) => ({
          ...obj,
          name: obj.id.split('/').pop() || obj.id,
        }));
      }

      return files;
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
