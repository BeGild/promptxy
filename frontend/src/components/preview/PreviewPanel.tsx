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
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      {/* 输入区域 */}
      <div style={{ flex: 1, minWidth: '300px' }}>
        <Card className="border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10" style={{ padding: '16px', height: '100%' }}>
          <h4 style={{ marginBottom: '12px' }}>测试输入</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
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
              <div style={{ flex: 1 }}>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
      <div style={{ flex: 1, minWidth: '300px' }}>
        <Card className="border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10" style={{ padding: '16px', height: '100%' }}>
          <h4 style={{ marginBottom: '12px' }}>预览结果</h4>

          {previewMutation.isPending && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
              <Spinner>处理中...</Spinner>
            </div>
          )}

          {previewMutation.isError && (
            <Card
              className="border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10"
              style={{
                padding: '12px',
              }}
            >
              <div style={{ color: 'var(--heroui-colors-danger)' }}>
                {previewMutation.error?.message || '预览失败'}
              </div>
            </Card>
          )}

          {result && (
            <>
              <Card className="border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10" style={{ padding: '12px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                  原始文本:
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    backgroundColor: 'var(--heroui-colors-background)',
                    padding: '8px',
                    borderRadius: '4px',
                    whiteSpace: 'pre-wrap',
                    fontSize: '12px',
                  }}
                >
                  {typeof result.original === 'object'
                    ? JSON.stringify(result.original, null, 2)
                    : String(result.original)}
                </div>
              </Card>

              <Card className="border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10" style={{ padding: '12px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                  修改后:
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    backgroundColor: 'var(--heroui-colors-background)',
                    padding: '8px',
                    borderRadius: '4px',
                    whiteSpace: 'pre-wrap',
                    color: 'var(--heroui-colors-success)',
                    fontSize: '12px',
                  }}
                >
                  {typeof result.modified === 'object'
                    ? JSON.stringify(result.modified, null, 2)
                    : String(result.modified)}
                </div>
              </Card>

              {result.matches.length > 0 && (
                <Card className="border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10" style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                    匹配规则:
                  </div>
                  {result.matches.map((match: any, i: number) => (
                    <div key={i} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      • {match.ruleId} ({match.opType})
                    </div>
                  ))}
                </Card>
              )}

              {result.matches.length === 0 && (
                <Card className="border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10" style={{ padding: '12px' }}>
                  <div style={{ color: 'var(--heroui-colors-text-secondary)', fontSize: '12px' }}>
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
