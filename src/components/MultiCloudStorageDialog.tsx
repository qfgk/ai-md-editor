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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Cloud,
  Lock,
  Unlock,
  RefreshCw,
  Trash2,
  Download,
  Upload,
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploadFilename, setUploadFilename] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isEditingProvider, setIsEditingProvider] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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

  // Sync selectedProvider with activeTab
  useEffect(() => {
    const providerMap: Record<string, CloudProvider> = {
      github: CloudProvider.GITHUB,
      oss: CloudProvider.ALIYUN_OSS,
      cos: CloudProvider.TENCENT_COS,
      s3: CloudProvider.AWS_S3,
      minio: CloudProvider.MINIO,
    };
    const newProvider = providerMap[activeTab];
    if (newProvider && newProvider !== selectedProvider) {
      setSelectedProvider(newProvider);
      // Clear credentials and errors when switching providers
      setProviderCredentials({});
      setFieldErrors({});
      setCloudFiles([]);
      setIsEditingProvider(false);
      setSearchKeyword('');
      setCurrentPage(1);
    }

    // 对于新配置（未编辑状态），预填充有默认值的字段（仅 OSS 提供商）
    const savedCredentials = newProvider ? getCloudCredentials(newProvider) : null;
    if (!savedCredentials && !isEditingProvider && newProvider && newProvider !== CloudProvider.GITHUB) {
      const info = PROVIDER_INFO[newProvider];
      if (info && info.fields) {
        const defaultValues: Record<string, string> = {};
        info.fields.forEach(field => {
          if (field.defaultValue && !providerCredentials[field.name]) {
            defaultValues[field.name] = field.defaultValue;
          }
        });
        if (Object.keys(defaultValues).length > 0) {
          setProviderCredentials(defaultValues);
        }
      }
    }
  }, [activeTab, selectedProvider]);

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
    const errors: Record<string, string> = {};
    const missingFields: string[] = [];

    // 验证所有字段
    providerInfo.fields.forEach((field) => {
      const value = providerCredentials[field.name];

      // 检查必填
      if (field.required && !value) {
        missingFields.push(field.label);
        return;
      }

      // 运行字段验证
      if (value && field.validate) {
        const error = field.validate(value);
        if (error) {
          errors[field.name] = error;
        }
      }
    });

    // 如果有缺失字段
    if (missingFields.length > 0) {
      toast.error(`请填写必填字段: ${missingFields.join(', ')}`);
      return;
    }

    // 如果有验证错误
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      toast.error(firstError || '配置验证失败');
      return;
    }

    // 清除错误并保存
    setFieldErrors({});
    saveCloudCredentials(selectedProvider, providerCredentials);
    toast.success('凭证保存成功');
    setProviderCredentials({});
    setIsEditingProvider(false);
    loadCloudFiles();
  };

  const handleRemoveProviderCredentials = () => {
    removeCloudCredentials(selectedProvider);
    setCloudFiles([]);
    setFieldErrors({});
    setProviderCredentials({});
    setIsEditingProvider(false);
    toast.success('凭证已移除');
  };

  const handleEditProviderCredentials = () => {
    const savedCredentials = getCloudCredentials(selectedProvider);
    if (savedCredentials) {
      setProviderCredentials(savedCredentials);
      setIsEditingProvider(true);
    }
  };

  const handleCancelEdit = () => {
    setProviderCredentials({});
    setFieldErrors({});
    setIsEditingProvider(false);
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

  // 生成默认文件名
  const generateDefaultFilename = (): string => {
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    let defaultFilename = filename;
    if (titleMatch && titleMatch[1]) {
      // 清理标题使其成为有效的文件名
      let title = titleMatch[1].trim();
      // 移除文件名中的非法字符
      title = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
      title = title.replace(/\s+/g, ' ');
      // 限制长度
      if (title.length > 200) {
        title = title.substring(0, 200);
      }
      defaultFilename = title.endsWith('.md') ? title : `${title}.md`;
    }
    return defaultFilename;
  };

  const handleUploadClick = () => {
    setUploadFilename(generateDefaultFilename());
    setShowUploadDialog(true);
  };

  const handleConfirmUpload = async () => {
    if (!uploadFilename.trim()) {
      toast.error('请输入文件名');
      return;
    }
    setShowUploadDialog(false);
    setLoading(true);
    try {
      const storage = createCloudStorage(selectedProvider);
      await storage.upload({
        name: uploadFilename,
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

  const handleUploadToCloud = async () => {
    handleUploadClick();
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

  // 过滤和分页文件列表
  const getFilteredAndPaginatedFiles = () => {
    let filtered = cloudFiles;

    // 搜索过滤
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      filtered = cloudFiles.filter(file =>
        file.name.toLowerCase().includes(keyword)
      );
    }

    // 分页
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedFiles = filtered.slice(startIndex, endIndex);

    return {
      files: paginatedFiles,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize),
    };
  };

  const { files: displayFiles, total, totalPages } = getFilteredAndPaginatedFiles();

  // 渲染文件列表（带搜索和分页）
  const renderFileList = (providerName: string) => {
    return (
      <div className="space-y-4 pt-4 border-t">
        <div className="flex gap-2">
          <Button onClick={handleUploadToCloud} disabled={loading} className="flex-1">
            <Plus size={16} className="mr-2" />
            上传到 {providerName}
          </Button>
          <Button onClick={loadCloudFiles} variant="outline" disabled={loading} className="flex-1">
            <RefreshCw size={16} className="mr-2" />
            刷新列表
          </Button>
        </div>

        {/* 搜索框 */}
        {cloudFiles.length > 0 && (
          <div className="relative">
            <Input
              placeholder="搜索文件名..."
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCurrentPage(1); // 重置到第一页
              }}
              className="pr-8"
            />
            {searchKeyword && (
              <button
                onClick={() => {
                  setSearchKeyword('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* 文件列表 */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {displayFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {searchKeyword ? '没有找到匹配的文件' : '暂无文件'}
            </p>
          ) : (
            displayFiles.map((file) => (
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

        {/* 分页控件 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              共 {total} 个文件，第 {currentPage} / {totalPages} 页
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-3"
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-3"
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderProviderFields = (provider: CloudProvider) => {
    const info = PROVIDER_INFO[provider];
    const savedCredentials = getCloudCredentials(provider);
    const isEditing = isEditingProvider;
    const hasCredentials = !!savedCredentials;

    // 如果有凭证但不在编辑模式，显示操作按钮
    if (hasCredentials && !isEditing) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check size={16} />
            <span>已配置 {info.name}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleEditProviderCredentials} className="flex-1">
              <Settings size={16} className="mr-2" />
              编辑配置
            </Button>
            <Button variant="outline" size="sm" onClick={handleRemoveProviderCredentials} className="flex-1 text-destructive hover:text-destructive">
              <Trash2 size={16} className="mr-2" />
              删除
            </Button>
          </div>
        </div>
      );
    }

    // 编辑模式或新配置模式，显示表单
    return (
      <div className="space-y-4">
        {isEditing && (
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
            <Settings size={16} />
            <span>正在编辑 {info.name} 配置</span>
          </div>
        )}
        {info.fields.map((field) => {
          const error = fieldErrors[field.name];
          const value = providerCredentials[field.name] || field.defaultValue || '';

          return (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name} className={error ? 'text-destructive' : ''}>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>

              {field.type === 'select' ? (
                <Select
                  value={value}
                  onValueChange={(newValue) => {
                    setProviderCredentials({
                      ...providerCredentials,
                      [field.name]: newValue,
                    });

                    // 清除该字段的错误
                    if (fieldErrors[field.name]) {
                      setFieldErrors({
                        ...fieldErrors,
                        [field.name]: '',
                      });
                    }
                  }}
                >
                  <SelectTrigger className={error ? 'border-destructive' : ''}>
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field.name}
                  type={field.type === 'password' ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={value}
                  className={error ? 'border-destructive' : ''}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setProviderCredentials({
                      ...providerCredentials,
                      [field.name]: newValue,
                    });

                    // 清除该字段的错误
                    if (fieldErrors[field.name]) {
                      setFieldErrors({
                        ...fieldErrors,
                        [field.name]: '',
                      });
                    }
                  }}
                />
              )}

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
          );
        })}
        <div className="flex gap-2">
          <Button onClick={handleSaveProviderCredentials} className="flex-1">
            <Check size={16} className="mr-2" />
            {isEditing ? '更新凭证' : '保存凭证'}
          </Button>
          {isEditing && (
            <Button variant="outline" onClick={handleCancelEdit} className="flex-1">
              取消
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>访问 <a href={info.helpUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{info.name} 文档</a> 了解如何获取凭证</p>
        </div>
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
            {isProviderConfigured(CloudProvider.ALIYUN_OSS) && renderFileList('OSS')}
          </TabsContent>

          <TabsContent value="cos" className="space-y-4 mt-4">
            {renderProviderFields(CloudProvider.TENCENT_COS)}
            {isProviderConfigured(CloudProvider.TENCENT_COS) && renderFileList('COS')}
          </TabsContent>

          <TabsContent value="s3" className="space-y-4 mt-4">
            {renderProviderFields(CloudProvider.AWS_S3)}
            {isProviderConfigured(CloudProvider.AWS_S3) && renderFileList('S3')}
          </TabsContent>

          <TabsContent value="minio" className="space-y-4 mt-4">
            {renderProviderFields(CloudProvider.MINIO)}
            {isProviderConfigured(CloudProvider.MINIO) && renderFileList('MinIO')}
          </TabsContent>
        </Tabs>

        {/* 上传文件名对话框 */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>设置上传文件名</DialogTitle>
              <DialogDescription>
                输入要保存到云端的文件名，已根据文档标题自动填充
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="upload-filename">文件名</Label>
                <Input
                  id="upload-filename"
                  value={uploadFilename}
                  onChange={(e) => setUploadFilename(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleConfirmUpload();
                    }
                  }}
                  placeholder="document.md"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  文件名将自动添加 .md 扩展名（如未包含）
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                取消
              </Button>
              <Button onClick={handleConfirmUpload} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 animate-spin" size={16} />
                    上传中...
                  </>
                ) : (
                  <>
                    <Upload size={16} className="mr-2" />
                    确认上传
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
