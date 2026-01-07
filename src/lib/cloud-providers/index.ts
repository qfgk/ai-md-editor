import { CloudProvider, type CloudStorageConfig, type ICloudStorage, type ConfigField } from './types';
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
        path: credentials.path || '',
      });

    case CloudProvider.TENCENT_COS:
      return new TencentCOSStorage({
        region: credentials.region,
        bucket: credentials.bucket,
        secretId: credentials.secretId,
        secretKey: credentials.secretKey,
        path: credentials.path || '',
      });

    case CloudProvider.AWS_S3:
      return new AWSS3Storage({
        region: credentials.region,
        bucket: credentials.bucket,
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        path: credentials.path || '',
      });

    case CloudProvider.MINIO:
      return new MinIOStorage({
        endPoint: credentials.endPoint,
        port: parseInt(credentials.port || '9000'),
        useSSL: credentials.useSSL === 'true',
        bucket: credentials.bucket,
        accessKey: credentials.accessKey,
        secretKey: credentials.secretKey,
        path: credentials.path || '',
      });

    default:
      throw new Error(`不支持的云存储提供商: ${provider}`);
  }
}

/**
 * 云存储提供商信息
 */
export const PROVIDER_INFO: Record<CloudProvider, {
  name: string;
  icon: string;
  description: string;
  fields: ConfigField[];
  helpUrl: string;
}> = {
  [CloudProvider.ALIYUN_OSS]: {
    name: '阿里云 OSS',
    icon: '🟠',
    description: '阿里云对象存储服务',
    fields: [
      {
        name: 'region',
        label: '区域',
        placeholder: 'oss-cn-hangzhou',
        required: true,
        validate: (value) => {
          if (!value) return '请输入区域';
          if (!value.startsWith('oss-')) return '区域格式错误，应为 oss-cn-xxx';
          return null;
        }
      },
      {
        name: 'bucket',
        label: 'Bucket 名称',
        placeholder: 'my-bucket',
        required: true,
        validate: (value) => {
          if (!value) return '请输入 Bucket 名称';
          if (value.length < 3 || value.length > 63) return 'Bucket 名称长度应为 3-63 个字符';
          if (!/^[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]$/.test(value)) return 'Bucket 名称只能包含小写字母、数字和连字符';
          return null;
        }
      },
      {
        name: 'accessKeyId',
        label: 'AccessKey ID',
        placeholder: 'LTAI5t...',
        required: true,
        validate: (value) => !value ? '请输入 AccessKey ID' : null
      },
      {
        name: 'accessKeySecret',
        label: 'AccessKey Secret',
        placeholder: '••••••••',
        required: true,
        type: 'password',
        validate: (value) => !value ? '请输入 AccessKey Secret' : null
      },
      {
        name: 'path',
        label: '上传路径',
        placeholder: 'docs/（可选，留空为根目录）',
        required: false,
        validate: (value) => {
          if (value && !value.startsWith('/') && !value.endsWith('/') && value.includes('/')) {
            return '路径格式应为 folder/ 或 folder/subfolder/';
          }
          return null;
        }
      },
    ],
    helpUrl: 'https://help.aliyun.com/product/31815.html',
  },
  [CloudProvider.TENCENT_COS]: {
    name: '腾讯云 COS',
    icon: '🔵',
    description: '腾讯云对象存储服务',
    fields: [
      {
        name: 'region',
        label: '区域',
        placeholder: 'ap-guangzhou',
        required: true,
        validate: (value) => {
          if (!value) return '请输入区域';
          if (!value.startsWith('ap-')) return '区域格式错误，应为 ap-xxx';
          return null;
        }
      },
      {
        name: 'bucket',
        label: 'Bucket 名称',
        placeholder: 'my-bucket-1234567890',
        required: true,
        validate: (value) => {
          if (!value) return '请输入 Bucket 名称';
          if (value.length < 1 || value.length > 50) return 'Bucket 名称长度应为 1-50 个字符';
          return null;
        }
      },
      {
        name: 'secretId',
        label: 'Secret ID',
        placeholder: 'AKIDxxxxxxxx',
        required: true,
        validate: (value) => !value ? '请输入 Secret ID' : null
      },
      {
        name: 'secretKey',
        label: 'Secret Key',
        placeholder: '••••••••',
        required: true,
        type: 'password',
        validate: (value) => !value ? '请输入 Secret Key' : null
      },
      {
        name: 'path',
        label: '上传路径',
        placeholder: 'docs/（可选，留空为根目录）',
        required: false,
        validate: (value) => {
          if (value && !value.startsWith('/') && !value.endsWith('/') && value.includes('/')) {
            return '路径格式应为 folder/ 或 folder/subfolder/';
          }
          return null;
        }
      },
    ],
    helpUrl: 'https://cloud.tencent.com/product/cos',
  },
  [CloudProvider.AWS_S3]: {
    name: 'AWS S3',
    icon: '🟢',
    description: '亚马逊 S3 云存储',
    fields: [
      {
        name: 'region',
        label: '区域',
        placeholder: 'us-east-1',
        required: true,
        validate: (value) => {
          if (!value) return '请输入区域';
          if (!/^[a-z]{2}-[a-z]+-\d{1}$/.test(value)) return '区域格式错误，例如 us-east-1';
          return null;
        }
      },
      {
        name: 'bucket',
        label: 'Bucket 名称',
        placeholder: 'my-bucket',
        required: true,
        validate: (value) => {
          if (!value) return '请输入 Bucket 名称';
          if (value.length < 3 || value.length > 63) return 'Bucket 名称长度应为 3-63 个字符';
          if (!/^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/.test(value)) return 'Bucket 名称只能包含小写字母、数字、点和连字符';
          return null;
        }
      },
      {
        name: 'accessKeyId',
        label: 'Access Key ID',
        placeholder: 'AKIAIOSFODNN7EXAMPLE',
        required: true,
        validate: (value) => {
          if (!value) return '请输入 Access Key ID';
          if (!/^AKIA[0-9A-Z]{16}$/.test(value)) return 'Access Key ID 格式错误';
          return null;
        }
      },
      {
        name: 'secretAccessKey',
        label: 'Secret Access Key',
        placeholder: '••••••••',
        required: true,
        type: 'password',
        validate: (value) => !value ? '请输入 Secret Access Key' : null
      },
      {
        name: 'path',
        label: '上传路径',
        placeholder: 'docs/（可选，留空为根目录）',
        required: false,
        validate: (value) => {
          if (value && !value.startsWith('/') && !value.endsWith('/') && value.includes('/')) {
            return '路径格式应为 folder/ 或 folder/subfolder/';
          }
          return null;
        }
      },
    ],
    helpUrl: 'https://aws.amazon.com/s3/',
  },
  [CloudProvider.MINIO]: {
    name: 'MinIO',
    icon: '🔷',
    description: '高性能对象存储 (S3 兼容)',
    fields: [
      {
        name: 'endPoint',
        label: '服务器地址',
        placeholder: 'minio.example.com',
        required: true,
        validate: (value) => {
          if (!value) return '请输入服务器地址';
          // 支持域名、IP 地址、localhost
          const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}|localhost|(\d{1,3}\.){3}\d{1,3}$/;
          if (!domainRegex.test(value)) return '请输入有效的服务器地址';
          return null;
        }
      },
      {
        name: 'port',
        label: '端口',
        placeholder: '9000',
        required: true,
        defaultValue: '9000',
        validate: (value) => {
          if (!value) return '请输入端口号';
          const port = parseInt(value);
          if (isNaN(port) || port < 1 || port > 65535) return '请输入有效的端口号 (1-65535)';
          return null;
        }
      },
      {
        name: 'useSSL',
        label: '使用 SSL',
        placeholder: '选择是否使用 SSL',
        required: true,
        type: 'select',
        defaultValue: 'false',
        options: [
          { label: '是 (HTTPS)', value: 'true' },
          { label: '否 (HTTP)', value: 'false' },
        ],
        validate: (value) => {
          if (!value) return '请选择是否使用 SSL';
          return null;
        }
      },
      {
        name: 'bucket',
        label: 'Bucket 名称',
        placeholder: 'my-bucket',
        required: true,
        validate: (value) => {
          if (!value) return '请输入 Bucket 名称';
          if (value.length < 3 || value.length > 63) return 'Bucket 名称长度应为 3-63 个字符';
          if (!/^[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]$/.test(value)) return 'Bucket 名称只能包含小写字母、数字和连字符';
          return null;
        }
      },
      {
        name: 'accessKey',
        label: 'Access Key',
        placeholder: '请输入 Access Key',
        required: true,
        validate: (value) => !value ? '请输入 Access Key' : null
      },
      {
        name: 'secretKey',
        label: 'Secret Key',
        placeholder: '请输入 Secret Key',
        required: true,
        type: 'password',
        validate: (value) => !value ? '请输入 Secret Key' : null
      },
      {
        name: 'path',
        label: '上传路径',
        placeholder: 'docs/（可选，留空为根目录）',
        required: false,
        validate: (value) => {
          if (value && !value.startsWith('/') && !value.endsWith('/') && value.includes('/')) {
            return '路径格式应为 folder/ 或 folder/subfolder/';
          }
          return null;
        }
      },
    ],
    helpUrl: 'https://min.io/docs/minio/linux/index.html',
  },
};

export * from './types';
