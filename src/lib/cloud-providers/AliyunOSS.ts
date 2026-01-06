import OSS from 'ali-oss';
import type { ICloudStorage, CloudFile, CloudFileInfo } from './types';

export class AliyunOSSStorage implements ICloudStorage {
  private client: OSS | null = null;
  private bucket: string;
  private region: string;

  constructor(config: { region: string; bucket: string; accessKeyId: string; accessKeySecret: string }) {
    this.bucket = config.bucket;
    this.region = config.region;

    try {
      this.client = new OSS({
        region: config.region,
        bucket: config.bucket,
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        secure: true, // 使用 HTTPS
      });
    } catch (error) {
      console.error('Aliyun OSS initialization failed:', error);
      throw new Error('阿里云 OSS 初始化失败');
    }
  }

  async upload(file: CloudFile): Promise<CloudFileInfo> {
    if (!this.client) throw new Error('OSS 客户端未初始化');

    try {
      const fileName = `${Date.now()}-${file.name}`;
      const result = await this.client.put(fileName, new Buffer(file.content));

      return {
        id: result.name,
        name: file.name,
        lastModified: new Date().toISOString(),
        size: file.content.length,
        url: result.url,
      };
    } catch (error: any) {
      console.error('Aliyun OSS upload failed:', error);
      throw new Error(`上传失败: ${error.message || '未知错误'}`);
    }
  }

  async download(fileId: string): Promise<string> {
    if (!this.client) throw new Error('OSS 客户端未初始化');

    try {
      const result = await this.client.get(fileId);
      return result.content.toString();
    } catch (error: any) {
      console.error('Aliyun OSS download failed:', error);
      throw new Error(`下载失败: ${error.message || '未知错误'}`);
    }
  }

  async listFiles(): Promise<CloudFileInfo[]> {
    if (!this.client) throw new Error('OSS 客户端未初始化');

    try {
      const result = await this.client.list({
        'max-keys': 100,
      });

      if (!result.objects) return [];

      return result.objects.map((obj) => ({
        id: obj.name,
        name: obj.name,
        lastModified: obj.lastModified,
        size: obj.size,
      }));
    } catch (error: any) {
      console.error('Aliyun OSS list files failed:', error);
      throw new Error(`列出文件失败: ${error.message || '未知错误'}`);
    }
  }

  async delete(fileId: string): Promise<void> {
    if (!this.client) throw new Error('OSS 客户端未初始化');

    try {
      await this.client.delete(fileId);
    } catch (error: any) {
      console.error('Aliyun OSS delete failed:', error);
      throw new Error(`删除失败: ${error.message || '未知错误'}`);
    }
  }

  async update(fileId: string, content: string): Promise<CloudFileInfo> {
    if (!this.client) throw new Error('OSS 客户端未初始化');

    try {
      // OSS 的更新实际上是覆盖上传
      const result = await this.client.put(fileId, new Buffer(content));

      return {
        id: result.name,
        name: fileId,
        lastModified: new Date().toISOString(),
        size: content.length,
        url: result.url,
      };
    } catch (error: any) {
      console.error('Aliyun OSS update failed:', error);
      throw new Error(`更新失败: ${error.message || '未知错误'}`);
    }
  }
}
