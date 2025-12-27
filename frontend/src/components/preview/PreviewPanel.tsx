/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - style={{ padding: '16px' }}
 * - style={{ gap: '8px' }}
 *
 * ✅ REQUIRED:
 * - className="p-md"
 * - className="gap-sm"
 */

import React, { useState } from 'react';
import { Textarea, Select, SelectItem, Input, Button, Spacer, Card, Spinner } from '@heroui/react';
import { usePreviewRule } from '@/hooks';
import { PromptxyClient, PromptxyField } from '@/types';

const CLIENT_OPTIONS = [
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'gemini', label: 'Gemini' },
];

const FIELD_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'instructions', label: 'Instructions' },
];

export const PreviewPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [client, setClient] = useState<PromptxyClient>('claude');
  const [field, setField] = useState<PromptxyField>('system');
  const [model, setModel] = useState('');
  const [path, setPath] = useState('/v1/messages');
  const [method, setMethod] = useState('POST');

  const previewMutation = usePreviewRule();

  const handlePreview = async () => {
    if (!input.trim()) return;

    const body: any = {};
    if (field === 'system') {
      body.system = input;
    } else {
      body.instructions = input;
    }
    if (model) body.model = model;

    previewMutation.mutate({
      body,
      client,
      field,
      model,
      path,
      method,
    });
  };

  const result = previewMutation.data;

  return (
    <div className="flex gap-md flex-wrap">
      {/* 输入区域 */}
      <div className="flex-1 min-w-[300px]">
        <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 p-md h-full">
          <h4 className="mb-mb3">测试输入</h4>

          <div className="flex flex-col gap-sm">
            <div className="flex gap-sm">
              <div className="flex-1">
                <Select
                  label="客户端"
                  selectedKeys={[client]}
                  onChange={e => setClient(e.target.value as PromptxyClient)}
                  fullWidth
                >
                  {CLIENT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value}>{opt.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="flex-1">
                <Select
                  label="字段"
                  selectedKeys={[field]}
                  onChange={e => setField(e.target.value as PromptxyField)}
                  fullWidth
                >
                  {FIELD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value}>{opt.label}</SelectItem>
                  ))}
                </Select>
              </div>
            </div>

            <Input
              label="模型 (可选)"
              placeholder="claude-3-sonnet-20240229"
              value={model}
              onChange={e => setModel(e.target.value)}
              fullWidth
            />

            <Input
              label="路径"
              placeholder="/v1/messages"
              value={path}
              onChange={e => setPath(e.target.value)}
              fullWidth
            />

            <Input
              label="HTTP方法"
              placeholder="POST"
              value={method}
              onChange={e => setMethod(e.target.value)}
              fullWidth
            />

            <Textarea
              label="输入文本"
              placeholder="在此输入要测试的文本..."
              value={input}
              onChange={e => setInput(e.target.value)}
              fullWidth
              minRows={8}
            />
          </div>

          <Spacer y={1} />

          <div className="flex justify-end">
            <Button
              color="primary"
              onPress={handlePreview}
              isDisabled={!input.trim()}
              isLoading={previewMutation.isPending}
            >
              预览效果
            </Button>
          </div>
        </Card>
      </div>

      {/* 输出区域 */}
      <div className="flex-1 min-w-[300px]">
        <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 p-md h-full">
          <h4 className="mb-mb3">预览结果</h4>

          {previewMutation.isPending && (
            <div className="flex justify-center p-xl">
              <Spinner>处理中...</Spinner>
            </div>
          )}

          {previewMutation.isError && (
            <Card
              className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 p-sm"
            >
              <div className="text-error">{previewMutation.error?.message || '预览失败'}</div>
            </Card>
          )}

          {result && (
            <>
              <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 p-sm mb-2">
                <div className="font-semibold text-sm mb-1">
                  原始文本:
                </div>
                <div
                  className="font-mono bg-canvas p-sm rounded-sm whitespace-pre-wrap text-xs"
                >
                  {typeof result.original === 'object'
                    ? JSON.stringify(result.original, null, 2)
                    : String(result.original)}
                </div>
              </Card>

              <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 p-sm mb-2">
                <div className="font-semibold text-sm mb-1">
                  修改后:
                </div>
                <div
                  className="font-mono bg-canvas p-sm rounded-sm whitespace-pre-wrap text-xs text-success"
                >
                  {typeof result.modified === 'object'
                    ? JSON.stringify(result.modified, null, 2)
                    : String(result.modified)}
                </div>
              </Card>

              {result.matches.length > 0 && (
                <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 p-sm">
                  <div className="font-semibold text-sm mb-1">
                    匹配规则:
                  </div>
                  {result.matches.map((match: any, i: number) => (
                    <div key={i} className="font-mono text-xs">
                      • {match.ruleId} ({match.opType})
                    </div>
                  ))}
                </Card>
              )}

              {result.matches.length === 0 && (
                <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 p-sm">
                  <div className="text-secondary text-xs">
                    无规则匹配
                  </div>
                </Card>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
