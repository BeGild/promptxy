import React, { useState, useEffect } from 'react';
import {
  Input,
  Textarea,
  Select,
  SelectItem,
  Button,
  Checkbox,
  Card,
  CardBody,
  Chip,
  Divider,
} from '@heroui/react';
import { PromptxyRule, PromptxyOp, PromptxyOpType } from '@/types';
import { validateRule, createDefaultRule, generateUUID } from '@/utils';
import { HelpTooltip } from './HelpTooltip';

interface RuleEditorProps {
  rule?: PromptxyRule | null;
  onSave: (rule: PromptxyRule) => void;
  onCancel: () => void;
  onPreview?: (rule: PromptxyRule) => void;
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

export const RuleEditor: React.FC<RuleEditorProps> = ({ rule, onSave, onCancel, onPreview }) => {
  const [formData, setFormData] = useState<PromptxyRule>(rule || createDefaultRule());
  const [validation, setValidation] = useState({
    valid: true,
    errors: [] as string[],
    warnings: [] as string[],
  });

  useEffect(() => {
    if (rule) {
      setFormData(rule);
    }
  }, [rule]);

  useEffect(() => {
    const result = validateRule(formData);
    setValidation(result);
  }, [formData]);

  const updateField = (path: string, value: any) => {
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
  };

  const addOp = () => {
    const newOp: PromptxyOp = { type: 'append', text: '' };
    setFormData(prev => ({
      ...prev,
      ops: [...prev.ops, newOp],
    }));
  };

  const updateOp = (index: number, updates: any) => {
    setFormData(prev => ({
      ...prev,
      ops: prev.ops.map((op, i) => (i === index ? ({ ...op, ...updates } as PromptxyOp) : op)),
    }));
  };

  const removeOp = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ops: prev.ops.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    if (validation.valid) {
      onSave(formData);
    }
  };

  const handlePreview = () => {
    if (onPreview && validation.valid) {
      onPreview(formData);
    }
  };

  const generateNewId = () => {
    setFormData(prev => ({ ...prev, id: `rule-${generateUUID()}` }));
  };

  return (
    <div className="max-h-[70vh] overflow-y-auto space-y-4 p-2">
      {/* 验证错误显示 */}
      {!validation.valid && (
        <Card className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <CardBody className="p-3">
            <div className="font-bold text-red-700 dark:text-red-400 mb-1">验证错误:</div>
            {validation.errors.map((err, i) => (
              <div key={i} className="text-sm text-red-600 dark:text-red-300">
                • {err}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* 警告显示 */}
      {validation.warnings.length > 0 && (
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <CardBody className="p-3">
            <div className="font-bold text-yellow-700 dark:text-yellow-400 mb-1">警告:</div>
            {validation.warnings.map((warn, i) => (
              <div key={i} className="text-sm text-yellow-600 dark:text-yellow-300">
                • {warn}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* 基本信息 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-bold">基本信息</h4>
            <Chip color="primary" variant="flat" size="sm">
              必填
            </Chip>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Input
                label="规则ID"
                placeholder="rule-xxx"
                value={formData.id}
                onChange={e => updateField('id', e.target.value)}
                isRequired
                radius="lg"
              />
            </div>
            <div>
              <Button
                size="sm"
                variant="flat"
                onPress={generateNewId}
                className="w-full mt-6"
                color="primary"
              >
                生成UUID
              </Button>
            </div>
          </div>
          <Textarea
            label="描述 (可选)"
            placeholder="描述这条规则的作用..."
            value={formData.description || ''}
            onChange={e => updateField('description', e.target.value)}
            radius="lg"
            minRows={2}
          />
        </CardBody>
      </Card>

      <Divider />

      {/* 匹配条件 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody className="space-y-3">
          <h4 className="text-lg font-bold">匹配条件 (When)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="客户端"
              selectedKeys={[formData.when.client]}
              onChange={e => updateField('when.client', e.target.value)}
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
              radius="lg"
            />
            <Input
              label="路径正则 (可选)"
              placeholder="^/v1/messages$"
              value={formData.when.pathRegex || ''}
              onChange={e => updateField('when.pathRegex', e.target.value || undefined)}
              radius="lg"
            />
            <div className="md:col-span-2">
              <Input
                label="模型正则 (可选)"
                placeholder="claude-3"
                value={formData.when.modelRegex || ''}
                onChange={e => updateField('when.modelRegex', e.target.value || undefined)}
                radius="lg"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Divider />

      {/* 操作序列 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold">操作序列 (Ops)</h4>
            <Chip color="secondary" variant="flat" size="sm">
              {formData.ops.length} 个操作
            </Chip>
          </div>
          <div className="text-sm text-gray-500">按顺序执行操作，支持拖拽调整顺序（暂未实现）</div>

          <div className="space-y-3">
            {formData.ops.map((op, index) => (
              <Card
                key={index}
                className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700"
              >
                <CardBody className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Chip color="primary" size="sm" className="font-bold">
                        操作 {index + 1}
                      </Chip>
                      <Chip color="default" variant="flat" size="sm" className="uppercase text-xs">
                        {op.type}
                      </Chip>
                    </div>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={() => removeOp(index)}
                      className="hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      删除
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-1">
                      <Select
                        label="类型"
                        selectedKeys={[op.type]}
                        onChange={e => updateOp(index, { type: e.target.value as PromptxyOpType })}
                        radius="lg"
                        isRequired
                      >
                        {OP_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </Select>
                    </div>

                    {/* 动态字段 */}
                    {(op.type === 'set' || op.type === 'append' || op.type === 'prepend') && (
                      <div className="md:col-span-2">
                        <Textarea
                          label="文本"
                          placeholder="输入文本内容..."
                          value={op.text || ''}
                          onChange={e => updateOp(index, { text: e.target.value })}
                          radius="lg"
                          minRows={1}
                          isRequired
                        />
                      </div>
                    )}

                    {(op.type === 'replace' || op.type === 'delete') && (
                      <>
                        <div>
                          <Input
                            label="匹配文本 (可选)"
                            placeholder="要匹配的文本"
                            value={op.match || ''}
                            onChange={e => updateOp(index, { match: e.target.value || undefined })}
                            radius="lg"
                          />
                        </div>
                        <div>
                          <Input
                            label={
                              <div className="flex items-center gap-1">
                                <span>正则表达式 (可选)</span>
                                <HelpTooltip type="regex" />
                              </div>
                            }
                            placeholder="pattern"
                            value={op.regex || ''}
                            onChange={e => updateOp(index, { regex: e.target.value || undefined })}
                            radius="lg"
                          />
                        </div>
                        <div>
                          <Input
                            label={
                              <div className="flex items-center gap-1">
                                <span>正则标志 (可选)</span>
                                <HelpTooltip type="flags" />
                              </div>
                            }
                            placeholder="gi"
                            value={op.flags || ''}
                            onChange={e => updateOp(index, { flags: e.target.value || undefined })}
                            radius="lg"
                          />
                        </div>
                        {op.type === 'replace' && (
                          <div className="md:col-span-3">
                            <Input
                              label="替换为"
                              placeholder="替换后的文本"
                              value={op.replacement || ''}
                              onChange={e => updateOp(index, { replacement: e.target.value })}
                              radius="lg"
                              isRequired
                            />
                          </div>
                        )}
                      </>
                    )}

                    {(op.type === 'insert_before' || op.type === 'insert_after') && (
                      <>
                        <div className="md:col-span-2">
                          <Input
                            label={
                              <div className="flex items-center gap-1">
                                <span>正则表达式</span>
                                <HelpTooltip type="regex" />
                              </div>
                            }
                            placeholder="pattern"
                            value={op.regex || ''}
                            onChange={e => updateOp(index, { regex: e.target.value })}
                            radius="lg"
                            isRequired
                          />
                        </div>
                        <div>
                          <Input
                            label={
                              <div className="flex items-center gap-1">
                                <span>正则标志 (可选)</span>
                                <HelpTooltip type="flags" />
                              </div>
                            }
                            placeholder="gi"
                            value={op.flags || ''}
                            onChange={e => updateOp(index, { flags: e.target.value || undefined })}
                            radius="lg"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <Textarea
                            label="插入文本"
                            placeholder="要插入的文本"
                            value={op.text || ''}
                            onChange={e => updateOp(index, { text: e.target.value })}
                            radius="lg"
                            minRows={1}
                            isRequired
                          />
                        </div>
                      </>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <Button variant="flat" onPress={addOp} className="w-full" color="primary">
            + 添加操作
          </Button>
        </CardBody>
      </Card>

      <Divider />

      {/* 高级选项 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody className="space-y-3">
          <h4 className="text-lg font-bold">高级选项</h4>
          <div className="flex flex-col gap-2">
            <Checkbox
              checked={formData.stop || false}
              onChange={e => updateField('stop', e.target.checked)}
            >
              在此规则后停止执行 (stop)
            </Checkbox>
            <Checkbox
              checked={formData.enabled !== false}
              onChange={e => updateField('enabled', e.target.checked)}
              color="success"
            >
              启用此规则
            </Checkbox>
          </div>
        </CardBody>
      </Card>

      {/* 操作按钮 */}
      <div className="flex gap-2 justify-end pt-2">
        {onPreview && (
          <Button color="warning" variant="flat" onPress={handlePreview}>
            预览
          </Button>
        )}
        <Button variant="light" onPress={onCancel}>
          取消
        </Button>
        <Button
          color="primary"
          onPress={handleSave}
          isDisabled={!validation.valid}
          className="shadow-lg"
        >
          保存
        </Button>
      </div>
    </div>
  );
};
