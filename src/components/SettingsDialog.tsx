import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";

export const SettingsDialog: React.FC = () => {
  const { fontSize, lineNumbers, wordWrap, updateSettings } = useSettings();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
          <Settings size={16} /> 设置
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑器设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>字体大小 ({fontSize}px)</Label>
              <p className="text-sm text-muted-foreground">调整编辑器文字大小。</p>
            </div>
            <Slider
              value={[fontSize]}
              min={12}
              max={24}
              step={1}
              className="w-[120px]"
              onValueChange={(val) => updateSettings({ fontSize: val[0] })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>显示行号</Label>
              <p className="text-sm text-muted-foreground">在编辑器左侧显示行号。</p>
            </div>
            <Switch
              checked={lineNumbers}
              onCheckedChange={(checked) => updateSettings({ lineNumbers: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>自动换行</Label>
              <p className="text-sm text-muted-foreground">长文本自动换行显示。</p>
            </div>
            <Switch
              checked={wordWrap}
              onCheckedChange={(checked) => updateSettings({ wordWrap: checked })}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
