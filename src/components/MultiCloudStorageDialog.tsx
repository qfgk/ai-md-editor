import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Cloud,
  Lock,
  Unlock,
  RefreshCw,
  Trash2,
  Download,
  LogOut,
  Settings,
  Check,
  Plus,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  isAuthenticated,
  storeGitHubToken,
  removeGitHubToken,
  createGist,
  updateGist,
  getUserGists,
  deleteGist,
  loadGistFile,
  type GistData,
} from '@/lib/cloud-storage';
import {
  CloudProvider,
  createCloudStorage,
  saveCloudCredentials,
  getCloudCredentials,
  removeCloudCredentials,
  isProviderConfigured,
  PROVIDER_INFO,
  type CloudFileInfo,
} from '@/lib/cloud-providers';

interface MultiCloudStorageDialogProps {
  markdown: string;
  onLoadContent: (content: string) => void;
  filename?: string;
}

export function MultiCloudStorageDialog({
  markdown,
  onLoadContent,
  filename = 'document.md',
}: MultiCloudStorageDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'github' | 'oss' | 'cos' | 's3' | 'minio'>('github');

  // GitHub Gist 状态
  const [githubToken, setGithubToken] = useState('');
  const [gistDescription, setGistDescription] = useState('');
  const [gistIsPublic, setGistIsPublic] = useState(false);
  const [gists, setGists] = useState<GistData[]>([]);
  const [currentGistId, setCurrentGistId] = useState<string | null>(null);

  // 云存储状态
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>(CloudProvider.ALIYUN_OSS);
  const [providerCredentials, setProviderCredentials] = useState<Record<string, string>>({});
  const [cloudFiles, setCloudFiles] = useState<CloudFileInfo[]>([]);

  useEffect(() => {
    if (open && isAuthenticated()) {
      loadGists();
    }
  }, [open]);

  useEffect(() => {
    if (open && isProviderConfigured(selectedProvider)) {
      loadCloudFiles();
    }
  }, [open, selectedProvider]);

  // GitHub Gist 函数
  const loadGists = async () => {
    setLoading(true);
    try {
      const userGists = await getUserGists();
      setGists(userGists);
    } catch (error: any) {
      toast.error(error.message || '加载 Gist 列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = () => {
    if (!githubToken.trim()) {
      toast.error('请输入 GitHub Token');
      return;
    }
    storeGitHubToken(githubToken);
    toast.success('登录成功');
    setGithubToken('');
    loadGists();
  };

  const handleGithubLogout = () => {
    removeGitHubToken();
    setGists([]);
    setCurrentGistId(null);
    toast.success('已登出');
  };

  const handleSaveGist = async () => {
    setLoading(true);
    try {
      const files = [{ filename, content: markdown }];
      let result;

      if (currentGistId) {
        result = await updateGist(currentGistId, files, gistDescription);
        toast.success('Gist 更新成功');
      } else {
        result = await createGist(files, gistDescription, gistIsPublic);
        toast.success('Gist 创建成功');
        setCurrentGistId(result.id);
        await loadGists();
      }
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadGist = async (gistId: string, gistFilename: string) => {
    setLoading(true);
    try {
      const content = await loadGistFile(gistId, gistFilename);
      onLoadContent(content);
      setCurrentGistId(gistId);
      setOpen(false);
      toast.success('加载成功');
    } catch (error: any) {
      toast.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGist = async (gistId: string) => {
    if (!confirm('确定要删除这个 Gist 吗？')) return;

    setLoading(true);
    try {
      await deleteGist(gistId);
      if (currentGistId === gistId) {
        setCurrentGistId(null);
      }
      await loadGists();
      toast.success('删除成功');
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    } finally {
      setLoading(false);
    }
  };

  // 云存储函数
  const handleSaveProviderCredentials = () => {
    const providerInfo = PROVIDER_INFO[selectedProvider];
    const missingFields = providerInfo.fields
      .filter((field) => field.required && !providerCredentials[field.name])
      .map((field) => field.label);

    if (missingFields.length > 0) {
      toast.error(`请填写必填字段: ${missingFields.join(', ')}`);
      return;
    }

    saveCloudCredentials(selectedProvider, providerCredentials);
    toast.success('凭证保存成功');
    setProviderCredentials({});
    loadCloudFiles();
  };

  const handleRemoveProviderCredentials = () => {
    removeCloudCredentials(selectedProvider);
    setCloudFiles([]);
    toast.success('凭证已移除');
  };

  const loadCloudFiles = async () => {
    setLoading(true);
    try {
      const storage = createCloudStorage(selectedProvider);
      const files = await storage.listFiles();
      setCloudFiles(files);
    } catch (error: any) {
      toast.error(error.message || '加载文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadToCloud = async () => {
    setLoading(true);
    try {
      const storage = createCloudStorage(selectedProvider);
      const result = await storage.upload({
        name: filename,
        content: markdown,
      });
      toast.success('上传成功');
      await loadCloudFiles();
    } catch (error: any) {
      toast.error(error.message || '上传失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFromCloud = async (fileId: string) => {
    setLoading(true);
    try {
      const storage = createCloudStorage(selectedProvider);
      const content = await storage.download(fileId);
      onLoadContent(content);
      setOpen(false);
      toast.success('加载成功');
    } catch (error: any) {
      toast.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFromCloud = async (fileId: string) => {
    if (!confirm('确定要删除这个文件吗？')) return;

    setLoading(true);
    try {
      const storage = createCloudStorage(selectedProvider);
      await storage.delete(fileId);
      toast.success('删除成功');
      await loadCloudFiles();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const renderProviderFields = (provider: CloudProvider) => {
    const info = PROVIDER_INFO[provider];
    const savedCredentials = getCloudCredentials(provider);

    if (savedCredentials) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check size={16} />
            <span>已配置 {info.name}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleRemoveProviderCredentials} className="w-full">
            <Settings size={16} className="mr-2" />
            重新配置
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {info.fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type={field.type || 'text'}
              placeholder={field.placeholder}
              value={providerCredentials[field.name] || ''}
              onChange={(e) =>
                setProviderCredentials({
                  ...providerCredentials,
                  [field.name]: e.target.value,
                })
              }
            />
          </div>
        ))}
        <Button onClick={handleSaveProviderCredentials} className="w-full">
          <Check size={16} className="mr-2" />
          保存凭证
        </Button>
        <p className="text-xs text-muted-foreground">
          访问{' '}
          <a
            href={info.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {info.name} 文档
          </a>{' '}
          了解如何获取凭证
        </p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="云存储">
          <Cloud size={18} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud size={20} />
            多云存储同步
          </DialogTitle>
          <DialogDescription>选择云存储提供商进行文档同步</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="github">GitHub</TabsTrigger>
            <TabsTrigger value="oss">阿里云</TabsTrigger>
            <TabsTrigger value="cos">腾讯云</TabsTrigger>
            <TabsTrigger value="s3">AWS S3</TabsTrigger>
            <TabsTrigger value="minio">MinIO</TabsTrigger>
          </TabsList>

          {/* GitHub Gist Tab */}
          <TabsContent value="github" className="space-y-4 mt-4">
            {!isAuthenticated() ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">请先创建 GitHub Personal Access Token：</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>访问 GitHub Settings → Developer settings</li>
                    <li>创建新 Token，勾选 `gist` 权限</li>
                    <li>复制 Token 并粘贴到下方</li>
                  </ol>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="github-token">GitHub Token</Label>
                  <Input
                    id="github-token"
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGithubLogin()}
                  />
                </div>
                <Button onClick={handleGithubLogin} className="w-full">
                  登录
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadGists} className="flex-1">
                    <RefreshCw size={16} className="mr-2" />
                    刷新列表
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleGithubLogout} className="flex-1">
                    <LogOut size={16} className="mr-2" />
                    登出
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 p-4 border rounded-lg">
                    <h4 className="font-medium">保存到云端</h4>
                    <Input
                      placeholder="描述（可选）"
                      value={gistDescription}
                      onChange={(e) => setGistDescription(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGistIsPublic(!gistIsPublic)}
                      className="w-full"
                    >
                      {gistIsPublic ? (
                        <>
                          <Unlock size={16} className="mr-2" />
                          公开
                        </>
                      ) : (
                        <>
                          <Lock size={16} className="mr-2" />
                          私密
                        </>
                      )}
                    </Button>
                    <Button onClick={handleSaveGist} disabled={loading} className="w-full">
                      {loading ? <RefreshCw className="mr-2 animate-spin" size={16} /> : null}
                      {currentGistId ? '更新 Gist' : '创建 Gist'}
                    </Button>
                  </div>

                  <div className="space-y-2 p-4 border rounded-lg">
                    <h4 className="font-medium">从云端加载</h4>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {gists.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">暂无 Gist</p>
                      ) : (
                        gists.map((gist) => {
                          const filenames = Object.keys(gist.files);
                          return (
                            <div key={gist.id} className="text-sm p-2 border rounded hover:bg-muted/50">
                              <p className="font-medium truncate">{gist.description || '无描述'}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(gist.updated_at)}</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {filenames.map((fn) => (
                                  <Button
                                    key={fn}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleLoadGist(gist.id, fn)}
                                    className="h-7 text-xs"
                                  >
                                    <Download size={12} className="mr-1" />
                                    {fn}
                                  </Button>
                                ))}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteGist(gist.id)}
                                  className="h-7 text-xs text-destructive"
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* OSS Tabs */}
          <TabsContent value="oss" className="space-y-4 mt-4">
            {renderProviderFields(CloudProvider.ALIYUN_OSS)}
            {isProviderConfigured(CloudProvider.ALIYUN_OSS) && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex gap-2">
                  <Button onClick={handleUploadToCloud} disabled={loading} className="flex-1">
                    <Plus size={16} className="mr-2" />
                    上传到 OSS
                  </Button>
                  <Button onClick={loadCloudFiles} variant="outline" disabled={loading} className="flex-1">
                    <RefreshCw size={16} className="mr-2" />
                    刷新列表
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cloudFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无文件</p>
                  ) : (
                    cloudFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(file.lastModified)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadFromCloud(file.id)}
                            className="h-8"
                          >
                            <Download size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFromCloud(file.id)}
                            className="h-8 text-destructive"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cos" className="space-y-4 mt-4">
            {renderProviderFields(CloudProvider.TENCENT_COS)}
            {isProviderConfigured(CloudProvider.TENCENT_COS) && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex gap-2">
                  <Button onClick={handleUploadToCloud} disabled={loading} className="flex-1">
                    <Plus size={16} className="mr-2" />
                    上传到 COS
                  </Button>
                  <Button onClick={loadCloudFiles} variant="outline" disabled={loading} className="flex-1">
                    <RefreshCw size={16} className="mr-2" />
                    刷新列表
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cloudFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无文件</p>
                  ) : (
                    cloudFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(file.lastModified)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadFromCloud(file.id)}
                            className="h-8"
                          >
                            <Download size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFromCloud(file.id)}
                            className="h-8 text-destructive"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="s3" className="space-y-4 mt-4">
            {renderProviderFields(CloudProvider.AWS_S3)}
            {isProviderConfigured(CloudProvider.AWS_S3) && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex gap-2">
                  <Button onClick={handleUploadToCloud} disabled={loading} className="flex-1">
                    <Plus size={16} className="mr-2" />
                    上传到 S3
                  </Button>
                  <Button onClick={loadCloudFiles} variant="outline" disabled={loading} className="flex-1">
                    <RefreshCw size={16} className="mr-2" />
                    刷新列表
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cloudFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无文件</p>
                  ) : (
                    cloudFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(file.lastModified)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadFromCloud(file.id)}
                            className="h-8"
                          >
                            <Download size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFromCloud(file.id)}
                            className="h-8 text-destructive"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="minio" className="space-y-4 mt-4">
            {renderProviderFields(CloudProvider.MINIO)}
            {isProviderConfigured(CloudProvider.MINIO) && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex gap-2">
                  <Button onClick={handleUploadToCloud} disabled={loading} className="flex-1">
                    <Plus size={16} className="mr-2" />
                    上传到 MinIO
                  </Button>
                  <Button onClick={loadCloudFiles} variant="outline" disabled={loading} className="flex-1">
                    <RefreshCw size={16} className="mr-2" />
                    刷新列表
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cloudFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无文件</p>
                  ) : (
                    cloudFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(file.lastModified)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadFromCloud(file.id)}
                            className="h-8"
                          >
                            <Download size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFromCloud(file.id)}
                            className="h-8 text-destructive"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
