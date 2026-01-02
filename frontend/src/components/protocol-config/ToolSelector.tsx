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

import React from 'react';
import { Card, CardBody } from '@heroui/react';
import { Code, Sparkles, Bot } from 'lucide-react';

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  prefix: string;
}

const TOOLS: Tool[] = [
  {
    id: 'claude_code',
    name: 'Claude Code',
    description: 'Anthropic Claude 协议',
    icon: <Code size={24} />,
    prefix: '/claude',
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI 协议',
    icon: <Sparkles size={24} />,
    prefix: '/openai',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Google Gemini 协议',
    icon: <Bot size={24} />,
    prefix: '/gemini',
  },
];

interface ToolSelectorProps {
  selectedTool: string;
  onToolSelect: (toolId: string) => void;
}

export const ToolSelector: React.FC<ToolSelectorProps> = ({
  selectedTool,
  onToolSelect,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {TOOLS.map(tool => (
        <Card
          key={tool.id}
          isPressable
          onPress={() => onToolSelect(tool.id)}
          className={`transition-all hover:shadow-md ${
            selectedTool === tool.id
              ? 'border-2 border-brand-primary bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5'
              : 'border border-subtle bg-canvas dark:bg-secondary hover:border-brand-primary/50'
          }`}
          shadow="none"
        >
          <CardBody className="p-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div
                className={`p-3 rounded-xl ${
                  selectedTool === tool.id
                    ? 'bg-brand-primary text-canvas'
                    : 'bg-canvas dark:bg-secondary text-primary'
                }`}
              >
                {tool.icon}
              </div>
              <div>
                <h3 className="font-bold text-primary text-lg">{tool.name}</h3>
                <p className="text-sm text-secondary mt-1">{tool.description}</p>
                <div className="mt-2">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-mono ${
                      selectedTool === tool.id
                        ? 'bg-brand-primary/20 text-brand-primary'
                        : 'bg-canvas dark:bg-secondary/50 text-secondary'
                    }`}
                  >
                    {tool.prefix}
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
};