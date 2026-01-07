import { CloudProvider, createCloudStorage } from './cloud-providers';

/**
 * Upload image to configured cloud storage
 */
export async function uploadImage(
  file: File,
  provider: CloudProvider
): Promise<string> {
  try {
    const storage = createCloudStorage(provider);

    // Generate filename with timestamp
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'png';
    const filename = `images/${timestamp}-${randomStr}.${extension}`;

    // Upload file
    const url = await storage.upload(file, filename);

    return url;
  } catch (error) {
    console.error('Image upload failed:', error);
    throw new Error(`图片上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * Convert blob to file
 */
export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type });
}

/**
 * Extract image from clipboard event
 */
export async function extractImageFromClipboard(
  clipboardData: DataTransfer
): Promise<File | null> {
  const items = clipboardData.items;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile();
      if (file) {
        return file;
      }
    }
  }

  return null;
}

/**
 * Extract image from drop event
 */
export async function extractImageFromDrop(
  dataTransfer: DataTransfer
): Promise<File | null> {
  const files = dataTransfer.files;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (file.type.indexOf('image') !== -1) {
      return file;
    }
  }

  return null;
}

/**
 * Get image markdown syntax
 */
export function getImageMarkdown(url: string, alt?: string): string {
  return `![${alt || 'image'}](${url})\n`;
}
