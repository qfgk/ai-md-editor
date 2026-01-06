import { CloudProvider, type CloudStorageConfig, type ICloudStorage } from './types';
import { AliyunOSSStorage } from './AliyunOSS';
import { TencentCOSStorage } from './TencentCOS';
import { AWSS3Storage } from './AWSS3';
import { MinIOStorage } from './MinIO';

/**
 * 云存储凭证存储
 */
const CREDENTIALS_KEY = 'cloud_storage_credentials';

/**
 * 保存云存储凭证
 */
export function saveCloudCredentials(provider: CloudProvider, credentials: Record<string, string>): void {
  const allCredentials = getAllCloudCredentials();
  allCredentials[provider] = credentials;
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(allCredentials));
}

/**
 * 获取指定提供商的凭证
 */
export function getCloudCredentials(provider: CloudProvider): Record<string, string> | null {
  const allCredentials = getAllCloudCredentials();
  return allCredentials[provider] || null;
}

/**
 * 获取所有云存储凭证
 */
export function getAllCloudCredentials(): Record<string, Record<string, string>> {
  const data = localStorage.getItem(CREDENTIALS_KEY);
  return data ? JSON.parse(data) : {};
}

/**
 * 删除指定提供商的凭证
 */
export function removeCloudCredentials(provider: CloudProvider): void {
  const allCredentials = getAllCloudCredentials();
  delete allCredentials[provider];
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(allCredentials));
}

/**
 * 检查提供商是否已配置
 */
export function isProviderConfigured(provider: CloudProvider): boolean {
  return !!getCloudCredentials(provider);
}

/**
 * 云存储工厂
 * 根据提供商创建对应的云存储实例
 */
export function createCloudStorage(provider: CloudProvider): ICloudStorage {
  const credentials = getCloudCredentials(provider);

  if (!credentials) {
    throw new Error(`${provider} 未配置凭证`);
  }

  switch (provider) {
    case CloudProvider.ALIYUN_OSS:
      return new AliyunOSSStorage({
        region: credentials.region,
        bucket: credentials.bucket,
        accessKeyId: credentials.accessKeyId,
        accessKeySecret: credentials.accessKeySecret,
      });

    case CloudProvider.TENCENT_COS:
      return new TencentCOSStorage({
        region: credentials.region,
        bucket: credentials.bucket,
        secretId: credentials.secretId,
        secretKey: credentials.secretKey,
      });

    case CloudProvider.AWS_S3:
      return new AWSS3Storage({
        region: credentials.region,
        bucket: credentials.bucket,
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      });

    case CloudProvider.MINIO:
      return new MinIOStorage({
        endPoint: credentials.endPoint,
        port: parseInt(credentials.port || '9000'),
        useSSL: credentials.useSSL === 'true',
        bucket: credentials.bucket,
        accessKey: credentials.accessKey,
        secretKey: credentials.secretKey,
      });

    default:
      throw new Error(`不支持的云存储提供商: ${provider}`);
  }
}

/**
 * 云存储提供商信息
 */
export const PROVIDER_INFO = {
  [CloudProvider.ALIYUN_OSS]: {
    name: '阿里云 OSS',
    icon: '🟠',
    description: '阿里云对象存储服务',
    fields: [
      { name: 'region', label: '区域', placeholder: 'oss-cn-hangzhou', required: true },
      { name: 'bucket', label: 'Bucket 名称', placeholder: 'my-bucket', required: true },
      { name: 'accessKeyId', label: 'AccessKey ID', placeholder: 'LTAI5t...', required: true },
      { name: 'accessKeySecret', label: 'AccessKey Secret', placeholder: '...', required: true, type: 'password' },
    ],
    helpUrl: 'https://help.aliyun.com/product/31815.html',
  },
  [CloudProvider.TENCENT_COS]: {
    name: '腾讯云 COS',
    icon: '🔵',
    description: '腾讯云对象存储服务',
    fields: [
      { name: 'region', label: '区域', placeholder: 'ap-guangzhou', required: true },
      { name: 'bucket', label: 'Bucket 名称', placeholder: 'my-bucket-1234567890', required: true },
      { name: 'secretId', label: 'Secret ID', placeholder: 'AKIDxxxxxxxx', required: true },
      { name: 'secretKey', label: 'Secret Key', placeholder: 'xxxxxxxx', required: true, type: 'password' },
    ],
    helpUrl: 'https://cloud.tencent.com/product/cos',
  },
  [CloudProvider.AWS_S3]: {
    name: 'AWS S3',
    icon: '🟢',
    description: '亚马逊 S3 云存储',
    fields: [
      { name: 'region', label: '区域', placeholder: 'us-east-1', required: true },
      { name: 'bucket', label: 'Bucket 名称', placeholder: 'my-bucket', required: true },
      { name: 'accessKeyId', label: 'Access Key ID', placeholder: 'AKIAIOSFODNN7EXAMPLE', required: true },
      { name: 'secretAccessKey', label: 'Secret Access Key', placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', required: true, type: 'password' },
    ],
    helpUrl: 'https://aws.amazon.com/s3/',
  },
  [CloudProvider.MINIO]: {
    name: 'MinIO',
    icon: '🔷',
    description: '高性能对象存储 (S3 兼容)',
    fields: [
      { name: 'endPoint', label: '服务器地址', placeholder: 'minio.example.com', required: true },
      { name: 'port', label: '端口', placeholder: '9000', required: true },
      { name: 'useSSL', label: '使用 SSL', placeholder: 'false', required: true },
      { name: 'bucket', label: 'Bucket 名称', placeholder: 'my-bucket', required: true },
      { name: 'accessKey', label: 'Access Key', placeholder: 'minioadmin', required: true },
      { name: 'secretKey', label: 'Secret Key', placeholder: 'minioadmin', required: true, type: 'password' },
    ],
    helpUrl: 'https://min.io/docs/minio/linux/index.html',
  },
};

export * from './types';
