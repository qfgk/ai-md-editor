/**
 * Unified Cloud Storage Interface
 * 定义统一的云存储接口，支持多个云存储提供商
 */

export const CloudProvider = {
  GITHUB: 'github',
  ALIYUN_OSS: 'aliyun_oss',
  TENCENT_COS: 'tencent_cos',
  AWS_S3: 'aws_s3',
  MINIO: 'minio',
} as const;

export type CloudProvider = typeof CloudProvider[keyof typeof CloudProvider];

export interface CloudFile {
  name: string;
  content: string;
  lastModified?: Date;
  size?: number;
  url?: string;
}

export interface CloudStorageConfig {
  provider: CloudProvider;
  credentials: Record<string, string>;
}

export interface CloudFileInfo {
  id: string;
  name: string;
  lastModified: string;
  size: number;
  url?: string;
}

/**
 * 配置字段定义
 */
export interface ConfigField {
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
  type?: 'text' | 'password' | 'select';
  options?: Array<{ label: string; value: string }>;
  defaultValue?: string;
  validate?: (value: string) => string | null;
}

/**
 * 统一的云存储接口
 */
export interface ICloudStorage {
  /**
   * 上传文件
   */
  upload(file: CloudFile): Promise<CloudFileInfo>;

  /**
   * 上传二进制文件（图片等）
   */
  uploadBinary(file: File | Blob, filename: string, contentType?: string): Promise<string>;

  /**
   * 下载文件
   */
  download(fileId: string): Promise<string>;

  /**
   * 列出文件
   */
  listFiles(): Promise<CloudFileInfo[]>;

  /**
   * 删除文件
   */
  delete(fileId: string): Promise<void>;

  /**
   * 更新文件
   */
  update(fileId: string, content: string): Promise<CloudFileInfo>;
}
