/**
 * 协议转换实验室页面
 *
 * 提供：
 * - 选择供应商和模型
 * - 编辑示例请求
 * - 查看上游请求预览（脱敏）
 * - 查看转换 trace
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  Button,
  Select,
  SelectItem,
  Spinner,
  Divider,
  Chip,
  Badge,
  Tabs,
  Tab,
  Textarea,
} from '@heroui/react';
import {
  ArrowRight,
  Play,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSuppliers } from '@/hooks';
import { useConfig } from '@/hooks';
import axios from 'axios';
import { useAPI } from '@/hooks/useAPI';

// 示例请求 fixture
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

export const ProtocolLabPage: React.FC = () => {
  const { data: suppliersData, isLoading: suppliersLoading } = useSuppliers();
  const { data: config } = useConfig();

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedSample, setSelectedSample] = useState<keyof typeof SAMPLE_REQUESTS>('claude_simple');
  const [requestBody, setRequestBody] = useState<string>(
    JSON.stringify(SAMPLE_REQUESTS.claude_simple, null, 2),
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [preview, setPreview] = useState<TransformPreview | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const suppliers = suppliersData?.suppliers || [];
  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  // 初始化：选择第一个启用的供应商
  useEffect(() => {
    if (!selectedSupplierId && suppliers.length > 0) {
      const firstEnabled = suppliers.find(s => s.enabled);
      if (firstEnabled) {
        setSelectedSupplierId(firstEnabled.id);
      }
    }
  }, [suppliers, selectedSupplierId]);

  // 处理示例请求选择
  const handleSampleChange = (sampleKey: keyof typeof SAMPLE_REQUESTS) => {
    setSelectedSample(sampleKey);
    setRequestBody(JSON.stringify(SAMPLE_REQUESTS[sampleKey], null, 2));
  };

  // 运行转换预览
  const handleRunPreview = async () => {
    if (!selectedSupplierId) {
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

    setIsPreviewing(true);
    try {
      const response = await axios.post<TransformPreview>(
        '/_promptxy/transform/preview',
        {
          supplierId: selectedSupplierId,
          request: {
            method: 'POST',
            path: '/v1/messages',
            headers: {
              'content-type': 'application/json',
            },
            body: parsedBody,
          },
          stream: false,
        },
      );

      setPreview(response.data);
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || '预览失败';
      toast.error(errorMsg);
      setPreview(null);
    } finally {
      setIsPreviewing(false);
    }
  };

  // 复制到剪贴板
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`已复制: ${label}`);
    setTimeout(() => setCopied(null), 2000);
  };

  // 格式化 JSON 显示
  const formatJSON = (obj: any): string => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary mb-2">
          协议转换实验室
        </h1>
        <p className="text-secondary text-sm">
          预览和验证协议转换配置，支持查看转换后的请求和 trace 信息
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧：配置面板 */}
        <Card className="lg:col-span-1">
          <CardBody className="space-y-4">
            {/* 供应商选择 */}
            <div>
              <label className="text-sm font-medium text-primary mb-2 block">
                选择供应商
              </label>
              <Select
                placeholder="选择供应商"
                selectedKeys={selectedSupplierId ? [selectedSupplierId] : []}
                onSelectionChange={keys => {
                  const key = Array.from(keys)[0] as string;
                  setSelectedSupplierId(key);
                }}
                isDisabled={suppliersLoading}
                classNames={{
                  trigger: 'bg-default-100 dark:bg-default-50',
                }}
              >
                {suppliers.map(supplier => (
                  <SelectItem
                    key={supplier.id}
                    value={supplier.id}
                    textValue={supplier.name}
                  >
                    <div className="flex items-center gap-2">
                      <span>{supplier.name}</span>
                      <Chip size="sm" variant="flat" color={supplier.enabled ? 'success' : 'default'}>
                        {supplier.enabled ? '已启用' : '已禁用'}
                      </Chip>
                      {supplier.transformer && (
                        <Chip size="sm" variant="flat" color="primary">
                          转换
                        </Chip>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </Select>
            </div>

            {/* 供应商信息 */}
            {selectedSupplier && (
              <div className="p-3 rounded-lg bg-default-100 dark:bg-default-50 space-y-1">
                <div className="text-xs text-secondary">
                  <span className="font-medium">ID:</span> {selectedSupplier.id}
                </div>
                <div className="text-xs text-secondary">
                  <span className="font-medium">上游地址:</span> {selectedSupplier.baseUrl}
                </div>
                <div className="text-xs text-secondary">
                  <span className="font-medium">本地前缀:</span> {selectedSupplier.localPrefix}
                </div>
                {selectedSupplier.auth && (
                  <div className="text-xs text-secondary">
                    <span className="font-medium">认证类型:</span> {selectedSupplier.auth.type}
                  </div>
                )}
                {selectedSupplier.transformer && (
                  <div className="text-xs text-secondary">
                    <span className="font-medium">转换链:</span> {selectedSupplier.transformer.default.join(', ')}
                  </div>
                )}
              </div>
            )}

            <Divider />

            {/* 示例请求选择 */}
            <div>
              <label className="text-sm font-medium text-primary mb-2 block">
                选择示例请求
              </label>
              <div className="space-y-2">
                <Button
                  size="sm"
                  variant={selectedSample === 'claude_simple' ? 'solid' : 'bordered'}
                  color="primary"
                  className="w-full justify-start"
                  onPress={() => handleSampleChange('claude_simple')}
                >
                  Claude 简单请求
                </Button>
                <Button
                  size="sm"
                  variant={selectedSample === 'claude_with_tools' ? 'solid' : 'bordered'}
                  color="primary"
                  className="w-full justify-start"
                  onPress={() => handleSampleChange('claude_with_tools')}
                >
                  Claude 工具调用
                </Button>
              </div>
            </div>

            {/* 运行按钮 */}
            <Button
              color="primary"
              startContent={<Play className="w-4 h-4" />}
              onPress={handleRunPreview}
              isLoading={isPreviewing}
              isDisabled={!selectedSupplierId}
              className="w-full"
            >
              运行转换预览
            </Button>
          </CardBody>
        </Card>

        {/* 右侧：预览结果 */}
        <Card className="lg:col-span-2">
          <CardBody>
            <Tabs fullWidth color="primary" variant="underlined">
              <Tab key="request" title="请求预览">
                <div className="mt-4 space-y-4">
                  {!preview ? (
                    <div className="text-center py-12 text-secondary">
                      <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>选择供应商并运行预览以查看转换结果</p>
                    </div>
                  ) : (
                    <>
                      {/* 原始请求 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-primary">
                            原始请求（Anthropic）
                          </h3>
                          <Button
                            size="sm"
                            variant="light"
                            startContent={
                              copied === 'original' ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )
                            }
                            onPress={() =>
                              handleCopy(
                                formatJSON(preview.original),
                                'original',
                              )
                            }
                          >
                            {copied === 'original' ? '已复制' : '复制'}
                          </Button>
                        </div>
                        <pre className="bg-default-100 dark:bg-default-50 p-3 rounded-lg text-xs overflow-x-auto">
                          {formatJSON(preview.original)}
                        </pre>
                      </div>

                      {/* 转换箭头 */}
                      <div className="flex justify-center">
                        <ArrowRight className="w-6 h-6 text-primary" />
                      </div>

                      {/* 转换后请求 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-primary">
                            转换后请求（上游）
                          </h3>
                          <Button
                            size="sm"
                            variant="light"
                            startContent={
                              copied === 'transformed' ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )
                            }
                            onPress={() =>
                              handleCopy(
                                formatJSON(preview.transformed),
                                'transformed',
                              )
                            }
                          >
                            {copied === 'transformed' ? '已复制' : '复制'}
                          </Button>
                        </div>
                        <pre className="bg-default-100 dark:bg-default-50 p-3 rounded-lg text-xs overflow-x-auto">
                          {formatJSON(preview.transformed)}
                        </pre>
                      </div>

                      {/* cURL 命令 */}
                      {preview.curlCommand && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-primary">
                              cURL 命令（脱敏）
                            </h3>
                            <Button
                              size="sm"
                              variant="light"
                              startContent={
                                copied === 'curl' ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )
                              }
                              onPress={() =>
                                handleCopy(preview.curlCommand!, 'curl')
                              }
                            >
                              {copied === 'curl' ? '已复制' : '复制'}
                            </Button>
                          </div>
                          <pre className="bg-default-100 dark:bg-default-50 p-3 rounded-lg text-xs overflow-x-auto">
                            {preview.curlCommand}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Tab>

              <Tab key="trace" title="Trace">
                <div className="mt-4">
                  {!preview ? (
                    <div className="text-center py-12 text-secondary">
                      <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>运行预览以查看转换 trace</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* 转换摘要 */}
                      <div className="p-3 rounded-lg bg-default-100 dark:bg-default-50 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-secondary">供应商:</span>
                          <span className="text-sm font-medium text-primary">
                            {preview.trace.supplierName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-secondary">使用链:</span>
                          <Chip size="sm" color="primary" variant="flat">
                            {preview.trace.chainType}
                          </Chip>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-secondary">总耗时:</span>
                          <span className="text-sm font-medium text-primary">
                            {preview.trace.totalDuration}ms
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-secondary">状态:</span>
                          <Badge
                            color={preview.trace.success ? 'success' : 'danger'}
                            variant="flat"
                          >
                            {preview.trace.success ? '成功' : '失败'}
                          </Badge>
                        </div>
                      </div>

                      {/* 步骤列表 */}
                      <div>
                        <h4 className="text-sm font-medium text-primary mb-2">
                          转换步骤
                        </h4>
                        <div className="space-y-2">
                          {preview.trace.steps.map((step, index) => (
                            <div
                              key={index}
                              className="p-3 rounded-lg bg-default-100 dark:bg-default-50"
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
                                  <Chip
                                    size="sm"
                                    color={step.success ? 'success' : 'danger'}
                                    variant="flat"
                                  >
                                    {step.success ? 'OK' : 'FAIL'}
                                  </Chip>
                                  <span className="text-xs text-secondary">
                                    {step.duration}ms
                                  </span>
                                </div>
                              </div>
                              {step.error && (
                                <div className="mt-2 text-xs text-danger">
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
                              className="flex items-start gap-2 p-3 rounded-lg bg-warning-50 dark:bg-warning-100/10"
                            >
                              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-warning-800 dark:text-warning-200">
                                {warning}
                              </span>
                            </div>
                          ))}
                          {preview.trace.errors.map((error, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-2 p-3 rounded-lg bg-danger-50 dark:bg-danger-100/10"
                            >
                              <AlertTriangle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-danger-800 dark:text-danger-200">
                                {error}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
