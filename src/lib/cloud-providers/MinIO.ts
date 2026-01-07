import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { ICloudStorage, CloudFile, CloudFileInfo } from './types';

export class MinIOStorage implements ICloudStorage {
  private client: S3Client | null = null;
  private bucket: string;
  private endPoint: string;
  private path: string;

  constructor(config: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    bucket: string;
    accessKey: string;
    secretKey: string;
    path?: string;
  }) {
    this.bucket = config.bucket;
    this.endPoint = config.endPoint;
    this.path = config.path || '';

    try {
      // 构建 MinIO 的 endpoint URL
      const protocol = config.useSSL ? 'https' : 'http';
      const port = config.port ? `:${config.port}` : '';
      const endpoint = `${protocol}://${config.endPoint}${port}`;

      this.client = new S3Client({
        endpoint,
        region: 'us-east-1', // MinIO 默认区域
        credentials: {
          accessKeyId: config.accessKey,
          secretAccessKey: config.secretKey,
        },
        // 关闭 S3 的强制路径样式访问
        forcePathStyle: true,
      });
    } catch (error) {
      console.error('MinIO initialization failed:', error);
      throw new Error('MinIO 初始化失败');
    }
  }

  async upload(file: CloudFile): Promise<CloudFileInfo> {
    if (!this.client) throw new Error('MinIO 客户端未初始化');

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

      // 构建 MinIO 文件 URL
      const protocol = this.endPoint.startsWith('https') ? 'https' : 'http';
      const url = `${protocol}://${this.endPoint}/${this.bucket}/${fileName}`;

      return {
        id: fileName,
        name: file.name,
        lastModified: new Date().toISOString(),
        size: file.content.length,
        url,
      };
    } catch (error: any) {
      console.error('MinIO upload failed:', error);
      throw new Error(`上传失败: ${error.message || '未知错误'}`);
    }
  }

  async download(fileId: string): Promise<string> {
    if (!this.client) throw new Error('MinIO 客户端未初始化');

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
      console.error('MinIO download failed:', error);
      throw new Error(`下载失败: ${error.message || '未知错误'}`);
    }
  }

  async listFiles(): Promise<CloudFileInfo[]> {
    if (!this.client) throw new Error('MinIO 客户端未初始化');

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
      console.error('MinIO list files failed:', error);
      throw new Error(`列出文件失败: ${error.message || '未知错误'}`);
    }
  }

  async delete(fileId: string): Promise<void> {
    if (!this.client) throw new Error('MinIO 客户端未初始化');

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileId,
      });

      await this.client.send(command);
    } catch (error: any) {
      console.error('MinIO delete failed:', error);
      throw new Error(`删除失败: ${error.message || '未知错误'}`);
    }
  }

  async update(fileId: string, content: string): Promise<CloudFileInfo> {
    if (!this.client) throw new Error('MinIO 客户端未初始化');

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileId,
        Body: content,
        ContentType: 'text/markdown',
      });

      await this.client.send(command);

      const protocol = this.endPoint.startsWith('https') ? 'https' : 'http';
      const url = `${protocol}://${this.endPoint}/${this.bucket}/${fileId}`;

      return {
        id: fileId,
        name: fileId,
        lastModified: new Date().toISOString(),
        size: content.length,
        url,
      };
    } catch (error: any) {
      console.error('MinIO update failed:', error);
      throw new Error(`更新失败: ${error.message || '未知错误'}`);
    }
  }
}
