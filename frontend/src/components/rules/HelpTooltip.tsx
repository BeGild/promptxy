/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - 硬编码颜色值（如 #007acc, #ff0000）
 * - 硬编码尺寸值（如 16px, 8px）
 * - 旧 Tailwind 颜色类（如 gray-*, blue-*, slate-*）
 *
 * ✅ REQUIRED:
 * - 使用语义化变量和类名
 * - 参考 styles/tokens/colors.css 中的可用变量
 */

import React from 'react';
import { Popover, PopoverTrigger, PopoverContent, Button, Chip } from '@heroui/react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  type: 'regex' | 'flags';
}

/**
 * 正则表达式帮助内容
 */
const regexHelpContent = (
  <div className="p-2 space-y-4 max-w-md">
    <div>
      <h5 className="font-bold text-sm mb-2">基本语法</h5>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded">.</code>
          <span>匹配任意字符</span>
        </div>
        <div className="flex gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded">\d</code>
          <span>匹配数字</span>
        </div>
        <div className="flex gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded">\w</code>
          <span>匹配字母数字</span>
        </div>
        <div className="flex gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded">\s</code>
          <span>匹配空白</span>
        </div>
        <div className="flex gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded">*</code>
          <span>重复0次或更多</span>
        </div>
        <div className="flex gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded">+</code>
          <span>重复1次或更多</span>
        </div>
        <div className="flex gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded">?</code>
          <span>重复0次或1次</span>
        </div>
        <div className="flex gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded">{'{n,m}'}</code>
          <span>重复n到m次</span>
        </div>
        <div className="flex gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded">^</code>
          <span>匹配开头</span>
        </div>
        <div className="flex gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded">$</code>
          <span>匹配结尾</span>
        </div>
      </div>
    </div>

    <div>
      <h5 className="font-bold text-sm mb-2">常用示例</h5>
      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded whitespace-nowrap">^/v1/messages$</code>
          <span className="text-secondary">精确匹配路径</span>
        </div>
        <div className="flex items-start gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded whitespace-nowrap">claude-3.*</code>
          <span className="text-secondary">匹配 claude-3 开头</span>
        </div>
        <div className="flex items-start gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded whitespace-nowrap">{'\\d{3,5}'}</code>
          <span className="text-secondary">匹配3-5位数字</span>
        </div>
        <div className="flex items-start gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded whitespace-nowrap">https?://.*</code>
          <span className="text-secondary">匹配 http/https</span>
        </div>
        <div className="flex items-start gap-2">
          <code className="bg-canvas dark:bg-secondary px-1 rounded whitespace-nowrap">\[.*?\]</code>
          <span className="text-secondary">匹配方括号内容(非贪婪)</span>
        </div>
      </div>
    </div>

    <div>
      <h5 className="font-bold text-sm mb-2">特殊字符转义</h5>
      <div className="text-xs text-secondary">
        如需匹配 . * + ? ^ $ { } ( ) [ ] \ | 等特殊字符，请在前面加 \
      </div>
    </div>
  </div>
);

/**
 * 正则标志帮助内容
 */
const flagsHelpContent = (
  <div className="p-2 space-y-3 max-w-md">
    <h5 className="font-bold text-sm">正则标志说明</h5>
    <div className="space-y-2 text-xs">
      <div className="flex items-start gap-3 p-2 bg-canvas dark:bg-secondary/50 rounded">
        <Chip size="sm" color="primary" variant="flat">g</Chip>
        <div>
          <div className="font-semibold">global (全局匹配)</div>
          <div className="text-secondary">找到所有匹配项，而不只是第一个</div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-2 bg-canvas dark:bg-secondary/50 rounded">
        <Chip size="sm" color="primary" variant="flat">i</Chip>
        <div>
          <div className="font-semibold">ignore case (忽略大小写)</div>
          <div className="text-secondary">匹配时不区分大小写字母</div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-2 bg-canvas dark:bg-secondary/50 rounded">
        <Chip size="sm" color="primary" variant="flat">m</Chip>
        <div>
          <div className="font-semibold">multiline (多行模式)</div>
          <div className="text-secondary">^ 和 $ 匹配每行的开始/结束</div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-2 bg-canvas dark:bg-secondary/50 rounded">
        <Chip size="sm" color="primary" variant="flat">s</Chip>
        <div>
          <div className="font-semibold">dotall (点号匹配换行)</div>
          <div className="text-secondary">让 . 匹配包括换行符在内的所有字符</div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-2 bg-canvas dark:bg-secondary/50 rounded">
        <Chip size="sm" color="primary" variant="flat">u</Chip>
        <div>
          <div className="font-semibold">unicode (Unicode 模式)</div>
          <div className="text-secondary">正确处理 Unicode 字符（如中文、emoji）</div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-2 bg-canvas dark:bg-secondary/50 rounded">
        <Chip size="sm" color="primary" variant="flat">y</Chip>
        <div>
          <div className="font-semibold">sticky (粘滞模式)</div>
          <div className="text-secondary">从 lastIndex 位置开始匹配</div>
        </div>
      </div>
    </div>

    <div className="pt-2 border-t border-subtle">
      <div className="text-xs text-secondary">
        <strong className="text-primary">组合使用示例：</strong>
        <code className="ml-1 bg-canvas dark:bg-secondary px-1 rounded">gi</code>
        <span> - 全局匹配且忽略大小写</span>
      </div>
    </div>
  </div>
);

/**
 * 帮助提示组件
 * 提供悬停显示简短说明，点击弹出详细内容的帮助提示
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({ type }) => {
  const getShortDesc = () => {
    return type === 'regex' ? '正则表达式帮助' : '正则标志说明';
  };

  const getHelpContent = () => {
    return type === 'regex' ? regexHelpContent : flagsHelpContent;
  };

  return (
    <Popover placement="right" offset={10}>
      <PopoverTrigger>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          className="min-w-unit-6 h-unit-6 w-unit-6 text-tertiary hover:text-secondary dark:text-tertiary dark:hover:text-secondary"
          title={getShortDesc()}
        >
          <HelpCircle size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        {getHelpContent()}
      </PopoverContent>
    </Popover>
  );
};
