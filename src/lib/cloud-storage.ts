import axios from 'axios';

const GIST_API = 'https://api.github.com/gists';
const STORAGE_KEY = 'github_token';

export interface GistFile {
  filename: string;
  content: string;
}

export interface GistData {
  id: string;
  html_url: string;
  files: { [key: string]: { raw_url: string; filename: string } };
  created_at: string;
  updated_at: string;
  description: string;
}

/**
 * Store GitHub token in localStorage
 */
export function storeGitHubToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

/**
 * Get GitHub token from localStorage
 */
export function getGitHubToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Remove GitHub token from localStorage
 */
export function removeGitHubToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getGitHubToken();
}

/**
 * Create a new Gist
 */
export async function createGist(
  files: GistFile[],
  description: string = 'Markdown document from MD Editor',
  isPublic: boolean = false
): Promise<GistData> {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('未找到 GitHub Token，请先登录');
  }

  try {
    const response = await axios.post(
      GIST_API,
      {
        description,
        public: isPublic,
        files: files.reduce((acc, file) => {
          acc[file.filename] = { content: file.content };
          return acc;
        }, {} as { [key: string]: { content: string } }),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Create Gist failed:', error);
    if (error.response?.status === 401) {
      throw new Error('GitHub Token 无效，请重新登录');
    } else if (error.response?.status === 403) {
      throw new Error('GitHub API 速率限制，请稍后再试');
    }
    throw new Error('创建 Gist 失败');
  }
}

/**
 * Update an existing Gist
 */
export async function updateGist(
  gistId: string,
  files: GistFile[],
  description?: string
): Promise<GistData> {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('未找到 GitHub Token，请先登录');
  }

  try {
    const response = await axios.patch(
      `${GIST_API}/${gistId}`,
      {
        ...(description && { description }),
        files: files.reduce((acc, file) => {
          acc[file.filename] = { content: file.content };
          return acc;
        }, {} as { [key: string]: { content: string } }),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Update Gist failed:', error);
    if (error.response?.status === 401) {
      throw new Error('GitHub Token 无效，请重新登录');
    } else if (error.response?.status === 404) {
      throw new Error('Gist 不存在或无权访问');
    }
    throw new Error('更新 Gist 失败');
  }
}

/**
 * Get user's Gists
 */
export async function getUserGists(): Promise<GistData[]> {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('未找到 GitHub Token，请先登录');
  }

  try {
    const response = await axios.get(`${GIST_API}?per_page=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Get Gists failed:', error);
    if (error.response?.status === 401) {
      throw new Error('GitHub Token 无效，请重新登录');
    }
    throw new Error('获取 Gist 列表失败');
  }
}

/**
 * Get a specific Gist
 */
export async function getGist(gistId: string): Promise<GistData> {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('未找到 GitHub Token，请先登录');
  }

  try {
    const response = await axios.get(`${GIST_API}/${gistId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Get Gist failed:', error);
    if (error.response?.status === 404) {
      throw new Error('Gist 不存在或无权访问');
    }
    throw new Error('获取 Gist 失败');
  }
}

/**
 * Delete a Gist
 */
export async function deleteGist(gistId: string): Promise<void> {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('未找到 GitHub Token，请先登录');
  }

  try {
    await axios.delete(`${GIST_API}/${gistId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
  } catch (error: any) {
    console.error('Delete Gist failed:', error);
    if (error.response?.status === 404) {
      throw new Error('Gist 不存在或无权访问');
    }
    throw new Error('删除 Gist 失败');
  }
}

/**
 * Load file content from Gist
 */
export async function loadGistFile(gistId: string, filename: string): Promise<string> {
  const gist = await getGist(gistId);
  const file = gist.files[filename];

  if (!file) {
    throw new Error(`文件 ${filename} 不存在`);
  }

  try {
    const response = await axios.get(file.raw_url, {
      headers: {
        Authorization: `Bearer ${getGitHubToken()}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Load Gist file failed:', error);
    throw new Error('加载文件内容失败');
  }
}
