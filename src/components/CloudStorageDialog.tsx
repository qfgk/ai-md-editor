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
} from 'lucide-react';
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

interface CloudStorageDialogProps {
  markdown: string;
  onLoadContent: (content: string) => void;
  filename?: string;
}

export function CloudStorageDialog({
  markdown,
  onLoadContent,
  filename = 'document.md',
}: CloudStorageDialogProps) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [gists, setGists] = useState<GistData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentGistId, setCurrentGistId] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'save' | 'load'>('login');

  useEffect(() => {
    if (isAuthenticated() && open) {
      setView('save');
      loadGists();
    }
  }, [open]);

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

  const handleLogin = () => {
    if (!token.trim()) {
      toast.error('请输入 GitHub Token');
      return;
    }
    storeGitHubToken(token);
    toast.success('登录成功');
    setToken('');
    setView('save');
    loadGists();
  };

  const handleLogout = () => {
    removeGitHubToken();
    setGists([]);
    setCurrentGistId(null);
    setView('login');
    toast.success('已登出');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const files = [{ filename, content: markdown }];
      let result;

      if (currentGistId) {
        result = await updateGist(currentGistId, files, description);
        toast.success('Gist 更新成功');
      } else {
        result = await createGist(files, description, isPublic);
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

  const handleLoad = async (gistId: string, gistFilename: string) => {
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

  const handleDelete = async (gistId: string) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="云存储">
          <Cloud size={18} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud size={20} />
            云存储 (GitHub Gist)
          </DialogTitle>
          <DialogDescription>
            使用 GitHub Gist 云端存储和同步你的 Markdown 文档
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated() ? (
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">请先创建 GitHub Personal Access Token：</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>访问 GitHub Settings → Developer settings → Personal access tokens</li>
                <li>创建新 Token，勾选 `gist` 权限</li>
                <li>复制 Token 并粘贴到下方</li>
              </ol>
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">GitHub Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} className="w-full">
              登录
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tab Buttons */}
            <div className="flex gap-2 border-b">
              <Button
                variant={view === 'save' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('save')}
              >
                保存到云端
              </Button>
              <Button
                variant={view === 'load' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('load')}
              >
                从云端加载
              </Button>
            </div>

            {view === 'save' && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="description">描述（可选）</Label>
                  <Input
                    id="description"
                    placeholder="文档描述"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPublic(!isPublic)}
                    className="flex-1"
                  >
                    {isPublic ? <Unlock size={16} className="mr-2" /> : <Lock size={16} className="mr-2" />}
                    {isPublic ? '公开' : '私密'}
                  </Button>
                  {currentGistId && (
                    <span className="text-sm text-muted-foreground">
                      已关联 Gist: {currentGistId.slice(0, 8)}...
                    </span>
                  )}
                </div>

                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? <RefreshCw className="mr-2 animate-spin" size={16} /> : null}
                  {currentGistId ? '更新 Gist' : '创建 Gist'}
                </Button>
              </div>
            )}

            {view === 'load' && (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">我的 Gist 列表</h3>
                  <Button variant="outline" size="sm" onClick={loadGists}>
                    <RefreshCw size={16} className="mr-2" />
                    刷新
                  </Button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="text-center text-muted-foreground py-8">
                      加载中...
                    </div>
                  ) : gists.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      暂无 Gist
                    </div>
                  ) : (
                    gists.map((gist) => {
                      const filenames = Object.keys(gist.files);
                      return (
                        <div
                          key={gist.id}
                          className="border rounded-lg p-3 space-y-2 hover:bg-muted/50"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {gist.description || '无描述'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(gist.updated_at)}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {filenames.map((filename) => (
                                  <Button
                                    key={filename}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleLoad(gist.id, filename)}
                                    className="h-7 text-xs"
                                  >
                                    <Download size={12} className="mr-1" />
                                    {filename}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(gist.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="w-full"
              >
                <LogOut size={16} className="mr-2" />
                登出
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
