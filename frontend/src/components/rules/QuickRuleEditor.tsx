/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - 硬编码颜色值（如 #007aff, #f5f5f7）
 * - 硬编码尺寸值（如 400px, 16px）
 * - 旧 Tailwind 颜色类（如 gray-*, blue-*, slate-*）
 *
 * ✅ REQUIRED:
 * - 使用语义化变量和类名
 * - 参考 styles/tokens/colors.css 中的可用变量
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Input,
  Textarea,
  Select,
  SelectItem,
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Spinner,
} from '@heroui/react';
import { PromptxyRule, PromptxyOp, PromptxyOpType, RequestRecord, PromptxyClient } from '@/types';
import { validateRule, createDefaultRule, generateUUID } from '@/utils';
import { PlayCircle, CheckCircle, XCircle } from 'lucide-react';
import { RegexGenerator, RegexResult } from '@/utils/regexGenerator';
import { MatchMode } from '@/utils/regexGenerator';
import { previewRule } from '@/api/rules';

interface QuickRuleEditorProps {
  request: RequestRecord; // 当前请求，用于预填充
  onSave: (rule: PromptxyRule) => void;
  onCancel: () => void;
  onTest?: (rule: PromptxyRule) => void; // 测试规则回调
  /** 预填充的正则表达式选项（来自选中内容） */
  initialRegex?: {
    /** 用于 when 条件（pathRegex 或 modelRegex）或操作序列 */
    field: 'pathRegex' | 'modelRegex' | 'op';
    value: string;
    flags?: string;
    selectedText?: string;
  };
}

const CLIENT_OPTIONS = [
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'gemini', label: 'Gemini' },
];

const FIELD_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'instructions', label: 'Instructions' },
];

const OP_TYPE_OPTIONS = [
  { value: 'set', label: 'Set (设置)' },
  { value: 'append', label: 'Append (追加)' },
  { value: 'prepend', label: 'Prepend (前置)' },
  { value: 'replace', label: 'Replace (替换)' },
  { value: 'delete', label: 'Delete (删除)' },
  { value: 'insert_before', label: 'Insert Before (前插)' },
  { value: 'insert_after', label: 'Insert After (后插)' },
];

/**
 * 从请求的 originalBody 中提取 model 字段
 * @param request 请求记录
 * @returns model 值或 undefined
 */
const extractModelFromRequest = (request: RequestRecord): string | undefined => {
  try {
    let body: any;
    if (typeof request.originalBody === 'string') {
      body = JSON.parse(request.originalBody);
    } else if (request.originalBody) {
      body = request.originalBody;
    } else {
      return undefined;
    }
    return body?.model;
  } catch {
    return undefined;
  }
};

/**
 * 从请求创建默认规则
 * @param request 请求记录
 * @param initialRegex 预填充的正则表达式选项（可选）
 * @returns 规则对象
 */
const createRuleFromRequest = (
  request: RequestRecord,
  initialRegex?: {
    field: 'pathRegex' | 'modelRegex' | 'op';
    value: string;
    flags?: string;
    selectedText?: string;
  },
): PromptxyRule => {
  const rule = createDefaultRule();

  // 生成规则名称
  if (initialRegex?.selectedText) {
    const truncatedText =
      initialRegex.selectedText.length > 20
        ? initialRegex.selectedText.slice(0, 20) + '...'
        : initialRegex.selectedText;
    rule.name = `基于选中内容 "${truncatedText}" 的规则`;
    rule.description = `匹配选中内容: ${initialRegex.selectedText}`;
  } else {
    rule.name = `基于请求 ${request.id.slice(0, 8)} 的规则`;
    rule.description = `从请求路径 ${request.path} 创建的规则`;
  }

  // 将 string 类型的 client 转换为 PromptxyClient 类型
  rule.when.client =
    request.client === 'claude' || request.client === 'codex' || request.client === 'gemini'
      ? request.client
      : 'claude'; // 默认值

  rule.when.method = request.method;

  // 路径正则：使用 initialRegex 的值或默认值
  if (initialRegex?.field === 'pathRegex') {
    rule.when.pathRegex = initialRegex.value;
  } else {
    rule.when.pathRegex = `^${request.path}$`;
  }

  // Model 正则：从请求中提取 model 或使用 initialRegex 的值
  if (initialRegex?.field === 'modelRegex') {
    rule.when.modelRegex = initialRegex.value;
  } else {
    const model = extractModelFromRequest(request);
    if (model) {
      rule.when.modelRegex = `^${model}$`;
    }
  }

  // 如果 initialRegex 是用于操作序列，创建一个默认操作
  if (initialRegex?.field === 'op' && initialRegex.selectedText) {
    // 创建一个 replace 操作作为默认
    // 用户可以根据需要修改为 delete、insert_before、insert_after 等
    rule.ops = [
      {
        type: 'replace',
        regex: initialRegex.value,
        flags: initialRegex.flags || '',
        replacement: '', // 用户需要填写替换内容
      },
    ];
  }

  return rule;
};

export const QuickRuleEditor: React.FC<QuickRuleEditorProps> = ({
  request,
  onSave,
  onCancel,
  onTest,
  initialRegex,
}) => {
  const [formData, setFormData] = useState<PromptxyRule>(
    createRuleFromRequest(request, initialRegex),
  );
  const [validation, setValidation] = useState({
    valid: true,
    errors: [] as string[],
  });
  // 测试结果类型定义
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    original?: any;
    modified?: any;
    previewData?: {
      originalText: string;
      modifiedText: string;
      field: string;
    };
    error?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // 当 initialRegex 变化时重新初始化表单
  useEffect(() => {
    setFormData(createRuleFromRequest(request, initialRegex));
  }, [request.id, initialRegex]);

  useEffect(() => {
    const result = validateRule(formData);
    setValidation(result);
    // 清除测试结果当规则改变时
    setTestResult(null);
  }, [formData]);

  const updateField = useCallback((path: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current: any = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  }, []);

  const updateOp = useCallback((index: number, updates: any) => {
    setFormData(prev => ({
      ...prev,
      ops: prev.ops.map((op, i) => (i === index ? ({ ...op, ...updates } as PromptxyOp) : op)),
    }));
  }, []);

  const removeOp = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      ops: prev.ops.filter((_, i) => i !== index),
    }));
  }, []);

  const addOp = useCallback(() => {
    const newOp: PromptxyOp = { type: 'append', text: '' };
    setFormData(prev => ({
      ...prev,
      ops: [...prev.ops, newOp],
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (validation.valid) {
      onSave(formData);
    }
  }, [validation.valid, formData, onSave]);

  const handleTest = useCallback(async () => {
    if (!validation.valid) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      // 验证 client 是否为有效的 PromptxyClient
      const validClients: PromptxyClient[] = ['claude', 'codex', 'gemini'];
      const client: PromptxyClient = validClients.includes(request.client as PromptxyClient)
        ? (request.client as PromptxyClient)
        : 'claude';

      // 解析请求 body
      let body: any;
      if (typeof request.originalBody === 'string') {
        body = JSON.parse(request.originalBody);
      } else {
        body = request.originalBody;
      }

      // 提取 model
      const model = body?.model;

      // 辅助函数：从 system 或 instructions 字段提取文本内容
      // 支持：
      // - string
      // - string[]
      // - Claude system blocks: [{type: 'text', text: '...'}] / [{type:'text', text: string[]}]
      const extractText = (value: any): string => {
        if (typeof value === 'string') {
          return value;
        }
        if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
          return value.join('');
        }
        if (Array.isArray(value)) {
          // 处理 Claude API 格式: [{type: 'text', text: '...'}, ...]
          return value
            .filter(item => item?.type === 'text' && item?.text !== undefined && item?.text !== null)
            .map(item => {
              if (typeof item?.text === 'string') return item.text;
              if (Array.isArray(item?.text) && item.text.every((t: any) => typeof t === 'string')) {
                return item.text.join('');
              }
              return '';
            })
            .join('');
        }
        return '';
      };

      // 获取原始文本 - 从原始请求 body 中提取
      const field = formData.when.field;
      const originalText = extractText(field === 'system' ? body.system : body.instructions);

      // 调用 API 测试规则
      const result = await previewRule(
        request.originalBody,
        client,
        field,
        model,
        request.path,
        request.method,
        formData, // 传入正在测试的规则
      );

      // 获取修改后的文本 - 使用同样的 extractText 函数
      const modifiedText = extractText(
        field === 'system' ? result.modified?.system : result.modified?.instructions
      );

      // 检查是否有匹配（matches 数组不为空）
      const matched = result.matches && result.matches.length > 0;

      setTestResult({
        matched,
        original: result.original,
        modified: result.modified,
        previewData: {
          originalText,
          modifiedText,
          field,
        },
      });

      // 如果有 onTest 回调，也调用它（保持兼容）
      if (onTest) {
        onTest(formData);
      }
    } catch (error) {
      setTestResult({
        matched: false,
        error: error instanceof Error ? error.message : '测试失败',
      });
    } finally {
      setIsTesting(false);
    }
  }, [validation.valid, formData, request, onTest]);

  return (
    <div className="space-y-3">
      {/* 验证错误显示 */}
      {!validation.valid && (
        <Card className="rounded-lg overflow-hidden bg-status-error/10 dark:bg-status-error/20 border border-status-error/30 dark:border-status-error/20">
          <CardBody className="p-p3">
            <div className="font-bold text-status-error text-sm mb-1">验证错误:</div>
            {validation.errors.map((err, i) => (
              <div key={i} className="text-xs text-status-error">
                • {err}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* 基本信息 */}
      <Card className="rounded-lg overflow-hidden border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/5 dark:from-elevated dark:to-brand-primary/10">
        <CardBody className="space-y-sm">
          <h4 className="text-sm font-bold">基本信息</h4>
          <Input
            label="规则名称"
            placeholder="输入规则名称..."
            value={formData.name}
            onChange={e => updateField('name', e.target.value)}
            isRequired
            size="sm"
            radius="lg"
          />
          <Textarea
            label="描述 (可选)"
            placeholder="描述这条规则的作用..."
            value={formData.description || ''}
            onChange={e => updateField('description', e.target.value)}
            size="sm"
            radius="lg"
            minRows={2}
          />
        </CardBody>
      </Card>

      <Divider />

      {/* 匹配条件 */}
      <Card className="rounded-lg overflow-hidden border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/5 dark:from-elevated dark:to-brand-primary/10">
        <CardBody className="space-y-sm">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold">匹配条件</h4>
            <Chip size="sm" variant="flat">
              当前: {request.client} {request.method} {request.path}
            </Chip>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Select
              label="客户端"
              selectedKeys={[formData.when.client]}
              onChange={e => updateField('when.client', e.target.value)}
              size="sm"
              radius="lg"
              isRequired
            >
              {CLIENT_OPTIONS.map(opt => (
                <SelectItem key={opt.value}>{opt.label}</SelectItem>
              ))}
            </Select>
            <Select
              label="字段"
              selectedKeys={[formData.when.field]}
              onChange={e => updateField('when.field', e.target.value)}
              size="sm"
              radius="lg"
              isRequired
            >
              {FIELD_OPTIONS.map(opt => (
                <SelectItem key={opt.value}>{opt.label}</SelectItem>
              ))}
            </Select>
            <Input
              label="HTTP方法 (可选)"
              placeholder="GET, POST..."
              value={formData.when.method || ''}
              onChange={e => updateField('when.method', e.target.value || undefined)}
              size="sm"
              radius="lg"
            />
            <Input
              label="路径正则 (可选)"
              placeholder="^/v1/messages$"
              value={formData.when.pathRegex || ''}
              onChange={e => updateField('when.pathRegex', e.target.value || undefined)}
              size="sm"
              radius="lg"
            />
          </div>
        </CardBody>
      </Card>

      <Divider />

      {/* 操作序列 */}
      <Card className="rounded-lg overflow-hidden border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/5 dark:from-elevated dark:to-brand-primary/10">
        <CardBody className="space-y-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold">操作序列</h4>
            <Chip size="sm" variant="flat">
              {formData.ops.length} 个
            </Chip>
          </div>

          <div className="space-y-sm">
            {formData.ops.map((op, index) => (
              <Card
                key={index}
                className="rounded-lg overflow-hidden bg-canvas dark:bg-secondary/30 border border-subtle"
              >
                <CardBody className="space-y-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Chip size="sm" color="primary">
                        操作 {index + 1}
                      </Chip>
                      <Chip size="sm" variant="flat" className="uppercase text-xs">
                        {op.type}
                      </Chip>
                    </div>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={() => removeOp(index)}
                      className="min-w-8 h-6 text-xs"
                    >
                      删除
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Select
                      label="类型"
                      selectedKeys={[op.type]}
                      onChange={e => updateOp(index, { type: e.target.value as PromptxyOpType })}
                      size="sm"
                      radius="lg"
                      isRequired
                    >
                      {OP_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </Select>

                    {/* 文本字段 */}
                    {(op.type === 'set' || op.type === 'append' || op.type === 'prepend') && (
                      <Textarea
                        label="文本"
                        placeholder="输入文本内容..."
                        value={op.text || ''}
                        onChange={e => updateOp(index, { text: e.target.value })}
                        size="sm"
                        radius="lg"
                        minRows={2}
                        isRequired
                      />
                    )}

                    {/* replace/delete 操作 */}
                    {(op.type === 'replace' || op.type === 'delete') && (
                      <>
                        <Input
                          label="匹配文本 (可选)"
                          placeholder="要匹配的文本"
                          value={op.match || ''}
                          onChange={e => updateOp(index, { match: e.target.value || undefined })}
                          size="sm"
                          radius="lg"
                        />
                        <Input
                          label="正则表达式"
                          placeholder="pattern"
                          value={op.regex || ''}
                          onChange={e => updateOp(index, { regex: e.target.value || undefined })}
                          size="sm"
                          radius="lg"
                        />
                        <Input
                          label="正则标志 (可选)"
                          placeholder="gi"
                          value={op.flags || ''}
                          onChange={e => updateOp(index, { flags: e.target.value || undefined })}
                          size="sm"
                          radius="lg"
                        />
                        {op.type === 'replace' && (
                          <Input
                            label="替换为"
                            placeholder="替换后的文本"
                            value={op.replacement || ''}
                            onChange={e => updateOp(index, { replacement: e.target.value })}
                            size="sm"
                            radius="lg"
                            isRequired
                          />
                        )}
                      </>
                    )}

                    {/* insert 操作 */}
                    {(op.type === 'insert_before' || op.type === 'insert_after') && (
                      <>
                        <Input
                          label="正则表达式"
                          placeholder="pattern"
                          value={op.regex || ''}
                          onChange={e => updateOp(index, { regex: e.target.value || undefined })}
                          size="sm"
                          radius="lg"
                          isRequired
                        />
                        <Input
                          label="正则标志 (可选)"
                          placeholder="gi"
                          value={op.flags || ''}
                          onChange={e => updateOp(index, { flags: e.target.value || undefined })}
                          size="sm"
                          radius="lg"
                        />
                        <Textarea
                          label="插入文本"
                          placeholder="要插入的文本"
                          value={op.text || ''}
                          onChange={e => updateOp(index, { text: e.target.value })}
                          size="sm"
                          radius="lg"
                          minRows={2}
                          isRequired
                        />
                      </>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <Button variant="flat" onPress={addOp} size="sm" color="primary">
            + 添加操作
          </Button>
        </CardBody>
      </Card>

      {/* 测试结果 */}
      {testResult && (
        <Card
          className={`rounded-lg overflow-hidden border ${testResult.matched ? 'border-status-success/30 bg-status-success/10' : 'border-status-error/30 bg-status-error/10'}`}
        >
          <CardBody className="p-p3">
            <div className="flex items-center gap-2 mb-2">
              {testResult.matched ? (
                <CheckCircle size={16} className="text-status-success" />
              ) : (
                <XCircle size={16} className="text-status-error" />
              )}
              <span
                className={`text-sm font-medium ${testResult.matched ? 'text-status-success' : 'text-status-error'}`}
              >
                {testResult.matched ? '规则匹配成功' : '规则未匹配'}
              </span>
            </div>
            {testResult.error && (
              <div className="text-xs text-status-error mt-1">{testResult.error}</div>
            )}
            {testResult.previewData && (
              <div className="mt-2 space-y-2">
                {/* 字段信息 */}
                <div className="text-xs text-secondary">
                  修改字段: <span className="font-mono">{testResult.previewData.field}</span>
                </div>

                {/* 大小变化 */}
                <div className="text-xs text-secondary">
                  原始: {testResult.previewData.originalText.length} 字符 →
                  修改后: {testResult.previewData.modifiedText.length} 字符
                  {testResult.previewData.modifiedText.length > testResult.previewData.originalText.length ? (
                    <span className="text-status-success"> (+{testResult.previewData.modifiedText.length - testResult.previewData.originalText.length})</span>
                  ) : testResult.previewData.modifiedText.length < testResult.previewData.originalText.length ? (
                    <span className="text-status-error"> ({testResult.previewData.modifiedText.length - testResult.previewData.originalText.length})</span>
                  ) : (
                    <span> (无变化)</span>
                  )}
                </div>

                {/* 内容差异预览 - 只显示前 100 字符 */}
                {(testResult.previewData.originalText !== testResult.previewData.modifiedText) && (
                  <div className="mt-2 p-2 bg-canvas dark:bg-secondary/30 rounded border border-subtle">
                    <div className="text-xs font-medium mb-1">内容变化:</div>
                    <div className="text-xs font-mono space-y-1 max-h-32 overflow-auto">
                      {testResult.previewData.originalText.length > 0 && (
                        <div className="text-status-error/70">
                          - {testResult.previewData.originalText.slice(0, 100)}
                          {testResult.previewData.originalText.length > 100 ? '...' : ''}
                        </div>
                      )}
                      {testResult.previewData.modifiedText.length > 0 && (
                        <div className="text-status-success/70">
                          + {testResult.previewData.modifiedText.slice(0, 100)}
                          {testResult.previewData.modifiedText.length > 100 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2">
        <Button variant="light" onPress={onCancel} size="sm">
          取消
        </Button>
        {onTest && (
          <Button
            color="secondary"
            variant="flat"
            onPress={handleTest}
            isDisabled={!validation.valid || isTesting}
            isLoading={isTesting}
            startContent={!isTesting ? <PlayCircle size={16} /> : undefined}
            size="sm"
          >
            测试本规则
          </Button>
        )}
        <Button
          color="primary"
          onPress={handleSave}
          isDisabled={!validation.valid}
          className="ml-auto"
          size="sm"
        >
          保存规则
        </Button>
      </div>
    </div>
  );
};
