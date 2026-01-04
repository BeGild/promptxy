/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="bg-gray-50 dark:bg-gray-950"
 *
 * ✅ REQUIRED:
 * - className="bg-canvas dark:bg-secondary"
 */

import React, { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Textarea,
  Tabs,
  Tab,
  Chip,
  Badge,
  Spinner,
} from '@heroui/react';
import { Play, RefreshCw, CheckCircle2, XCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import type { Supplier } from '@/types/api';

// 示例请求
const SAMPLE_REQUESTS = {
  claude_simple: {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'Hello, how are you?',
      },
    ],
  },
  claude_with_tools: {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: 'What is the weather in Tokyo?',
      },
    ],
    tools: [
      {
        name: 'get_weather',
        description: 'Get the current weather in a given location',
        input_schema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
          },
          required: ['location'],
        },
      },
    ],
  },
  codex_simple: {
    model: 'gpt-4o-mini',
    instructions: 'You are a helpful assistant.',
    input: [
      {
        role: 'user',
        content: 'Hello, how are you?',
      },
    ],
  },
  gemini_simple: {
    contents: [
      {
        parts: [
          {
            text: 'Hello, how are you?',
          },
        ],
      },
    ],
  },
};

interface TransformTrace {
  supplierId: string;
  supplierName: string;
  chainType: string;
  chain: any[];
  steps: Array<{
    name: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  totalDuration: number;
  success: boolean;
  errors: string[];
  warnings: string[];
}

interface TransformPreview {
  original: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: any;
  };
  transformed: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: any;
  };
  trace: TransformTrace;
  curlCommand?: string;
}

interface TestValidationProps {
  supplier: Supplier | null;
  selectedToolPrefix: string;
}

export const TestValidation: React.FC<TestValidationProps> = ({
  supplier,
  selectedToolPrefix,
}) => {
  const [requestBody, setRequestBody] = useState<string>(
    JSON.stringify(
      selectedToolPrefix === '/claude'
        ? SAMPLE_REQUESTS.claude_simple
        : selectedToolPrefix === '/codex'
        ? SAMPLE_REQUESTS.codex_simple
        : SAMPLE_REQUESTS.gemini_simple,
      null,
      2,
    ),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [preview, setPreview] = useState<TransformPreview | null>(null);

  // 处理示例请求选择
  const handleSampleChange = (sampleKey: keyof typeof SAMPLE_REQUESTS) => {
    setRequestBody(JSON.stringify(SAMPLE_REQUESTS[sampleKey], null, 2));
  };

  // 运行测试
  const handleRunTest = async () => {
    if (!supplier) {
      toast.error('请先选择供应商');
      return;
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(requestBody);
    } catch {
      toast.error('请求体 JSON 格式无效');
      return;
    }

    setIsRunning(true);
    try {
      const response = await axios.post<TransformPreview>(
        '/_promptxy/transform/preview',
        {
          supplierId: supplier.id,
          request: {
            method: 'POST',
            path:
              selectedToolPrefix === '/claude'
                ? '/v1/messages'
                : selectedToolPrefix === '/codex'
                ? '/responses'
                : '/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent',
            headers: {
              'content-type': 'application/json',
            },
            body: parsedBody,
          },
          stream: false,
        },
      );

      setPreview(response.data);
      toast.success('测试完成！');
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || '测试失败';
      toast.error(errorMsg);
      setPreview(null);
    } finally {
      setIsRunning(false);
    }
  };

  // 格式化 JSON 显示
  const formatJSON = (obj: any): string => {
    return JSON.stringify(obj, null, 2);
  };

  if (!supplier) {
    return (
      <div className="text-center py-12 bg-canvas dark:bg-secondary/30 rounded-xl border border-dashed border-subtle">
        <Info size={48} className="mx-auto text-tertiary mb-3" />
        <p className="text-secondary font-medium">请先选择供应商</p>
        <p className="text-sm text-tertiary mt-1">选择供应商后可进行测试验证</p>
      </div>
    );
  }

  return (
    <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 shadow-sm">
      <CardBody className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play size={20} className="text-brand-primary" />
            <h3 className="text-lg font-bold text-primary">测试验证</h3>
          </div>
          <Button
            color="primary"
            size="sm"
            onPress={handleRunTest}
            isLoading={isRunning}
            startContent={<Play size={16} />}
            className="shadow-sm"
          >
            运行测试
          </Button>
        </div>

        {/* 示例请求选择 */}
        <div>
          <label className="text-sm font-medium text-primary mb-2 block">
            选择示例请求
          </label>
          <div className="flex gap-2 flex-wrap">
            {selectedToolPrefix === '/claude' && (
              <>
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  onPress={() => handleSampleChange('claude_simple')}
                >
                  简单请求
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  onPress={() => handleSampleChange('claude_with_tools')}
                >
                  工具调用
                </Button>
              </>
            )}
            {selectedToolPrefix === '/codex' && (
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={() => handleSampleChange('codex_simple')}
              >
                简单请求
              </Button>
            )}
            {selectedToolPrefix === '/gemini' && (
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={() => handleSampleChange('gemini_simple')}
              >
                简单请求
              </Button>
            )}
          </div>
        </div>

        {/* 请求编辑器 */}
        <div>
          <label className="text-sm font-medium text-primary mb-2 block">
            请求体
          </label>
          <Textarea
            value={requestBody}
            onChange={e => setRequestBody(e.target.value)}
            minRows={8}
            maxRows={16}
            variant="bordered"
            radius="lg"
            className="font-mono text-xs"
          />
        </div>

        {/* 测试结果 */}
        {preview && (
          <div className="space-y-4">
            <Tabs fullWidth color="primary" variant="underlined">
              <Tab key="request" title="请求预览">
                <div className="mt-4 space-y-4">
                  {/* 转换摘要 */}
                  <div className="p-4 rounded-lg bg-canvas dark:bg-secondary/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-secondary">状态:</span>
                        <Badge
                          color={preview.trace.success ? 'success' : 'danger'}
                          variant="flat"
                        >
                          {preview.trace.success ? '成功' : '失败'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-secondary">总耗时:</span>
                        <Chip size="sm" color="primary" variant="flat">
                          {preview.trace.totalDuration}ms
                        </Chip>
                      </div>
                    </div>
                  </div>

                  {/* 转换后请求 */}
                  <div>
                    <h4 className="text-sm font-medium text-primary mb-2">
                      转换后请求（上游）
                    </h4>
                    <pre className="bg-canvas dark:bg-secondary/50 p-3 rounded-lg text-xs overflow-x-auto">
                      {formatJSON(preview.transformed)}
                    </pre>
                  </div>
                </div>
              </Tab>

              <Tab key="trace" title="Trace">
                <div className="mt-4 space-y-4">
                  {/* 步骤列表 */}
                  <div>
                    <h4 className="text-sm font-medium text-primary mb-2">
                      转换步骤
                    </h4>
                    <div className="space-y-2">
                      {preview.trace.steps.map((step, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg bg-canvas dark:bg-secondary/50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-secondary">
                                {index + 1}.
                              </span>
                              <span className="text-sm font-medium text-primary">
                                {step.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {step.success ? (
                                <CheckCircle2
                                  size={16}
                                  className="text-status-success"
                                />
                              ) : (
                                <XCircle size={16} className="text-status-error" />
                              )}
                              <span className="text-xs text-secondary">
                                {step.duration}ms
                              </span>
                            </div>
                          </div>
                          {step.error && (
                            <div className="mt-2 text-xs text-status-error">
                              {step.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 警告和错误 */}
                  {(preview.trace.warnings.length > 0 ||
                    preview.trace.errors.length > 0) && (
                    <div className="space-y-2">
                      {preview.trace.warnings.map((warning, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg bg-warning-50 dark:bg-warning-100/10"
                        >
                          <span className="text-sm text-warning-800 dark:text-warning-200">
                            {warning}
                          </span>
                        </div>
                      ))}
                      {preview.trace.errors.map((error, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg bg-danger-50 dark:bg-danger-100/10"
                        >
                          <span className="text-sm text-danger-800 dark:text-danger-200">
                            {error}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Tab>
            </Tabs>
          </div>
        )}

        {/* 加载中 */}
        {isRunning && (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner color="primary" size="lg" />
            <p className="text-sm text-secondary mt-3">正在运行测试...</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
};
