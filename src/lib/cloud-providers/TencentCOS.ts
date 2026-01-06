import COS from 'cos-js-sdk-v5';
import type { ICloudStorage, CloudFile, CloudFileInfo } from './types';

export class TencentCOSStorage implements ICloudStorage {
  private client: COS | null = null;
  private bucket: string;
  private region: string;

  constructor(config: { bucket: string; region: string; secretId: string; secretKey: string }) {
    this.bucket = config.bucket;
    this.region = config.region;

    try {
      this.client = new COS({
        SecretId: config.secretId,
        SecretKey: config.secretKey,
      });
    } catch (error) {
      console.error('Tencent COS initialization failed:', error);
      throw new Error('腾讯云 COS 初始化失败');
    }
  }

  async upload(file: CloudFile): Promise<CloudFileInfo> {
    if (!this.client) throw new Error('COS 客户端未初始化');

    return new Promise((resolve, reject) => {
      const fileName = `${Date.now()}-${file.name}`;

      this.client!.putObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: fileName,
          Body: file.content,
        },
        (err: any, data: any) => {
          if (err) {
            console.error('Tencent COS upload failed:', err);
            reject(new Error(`上传失败: ${err.message || '未知错误'}`));
          } else {
            resolve({
              id: fileName,
              name: file.name,
              lastModified: new Date().toISOString(),
              size: file.content.length,
              url: `https://${data.Location}`,
            });
          }
        }
      );
    });
  }

  async download(fileId: string): Promise<string> {
    if (!this.client) throw new Error('COS 客户端未初始化');

    return new Promise((resolve, reject) => {
      this.client!.getObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: fileId,
        },
        (err: any, data: any) => {
          if (err) {
            console.error('Tencent COS download failed:', err);
            reject(new Error(`下载失败: ${err.message || '未知错误'}`));
          } else {
            resolve(data.Body.toString());
          }
        }
      );
    });
  }

  async listFiles(): Promise<CloudFileInfo[]> {
    if (!this.client) throw new Error('COS 客户端未初始化');

    return new Promise((resolve, reject) => {
      this.client!.getBucket(
        {
          Bucket: this.bucket,
          Region: this.region,
          Prefix: '',
          MaxKeys: 100,
        },
        (err: any, data: any) => {
          if (err) {
            console.error('Tencent COS list files failed:', err);
            reject(new Error(`列出文件失败: ${err.message || '未知错误'}`));
          } else {
            const files = (data.Contents || []).map((item: any) => ({
              id: item.Key,
              name: item.Key,
              lastModified: item.LastModified,
              size: item.Size,
            }));
            resolve(files);
          }
        }
      );
    });
  }

  async delete(fileId: string): Promise<void> {
    if (!this.client) throw new Error('COS 客户端未初始化');

    return new Promise((resolve, reject) => {
      this.client!.deleteObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: fileId,
        },
        (err: any) => {
          if (err) {
            console.error('Tencent COS delete failed:', err);
            reject(new Error(`删除失败: ${err.message || '未知错误'}`));
          } else {
            resolve();
          }
        }
      );
    });
  }

  async update(fileId: string, content: string): Promise<CloudFileInfo> {
    if (!this.client) throw new Error('COS 客户端未初始化');

    return new Promise((resolve, reject) => {
      this.client!.putObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: fileId,
          Body: content,
        },
        (err: any, data: any) => {
          if (err) {
            console.error('Tencent COS update failed:', err);
            reject(new Error(`更新失败: ${err.message || '未知错误'}`));
          } else {
            resolve({
              id: fileId,
              name: fileId,
              lastModified: new Date().toISOString(),
              size: content.length,
              url: `https://${data.Location}`,
            });
          }
        }
      );
    });
  }
}
