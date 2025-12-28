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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@heroui/react';
import { X, GripVertical } from 'lucide-react';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  defaultWidth?: number;  // 默认 40vw
  minWidth?: number;      // 默认 30vw
  maxWidth?: number;      // 默认 60vw
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  children,
  defaultWidth = 40,
  minWidth = 30,
  maxWidth = 60,
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // 拖拽调整宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing || !containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const newWidth = ((containerRect.right - e.clientX) / window.innerWidth) * 100;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth]);

  return (
    <div
      ref={containerRef}
      className={`
        flex-shrink-0 border-l border-subtle bg-canvas dark:bg-secondary relative
        transition-all duration-300 ease-in-out overflow-hidden
        ${isOpen ? 'opacity-100' : 'w-0 opacity-0'}
      `}
      style={isOpen ? { width: `${width}vw` } : {}}
    >
      {/* 拖拽手柄 - 调整大小指示器 */}
      {isResizing && (
        <div
          className="fixed inset-y-0 bg-brand-primary/20 dark:bg-brand-primary/30 cursor-col-resize z-50 pointer-events-none"
          style={{ width: '4px', right: `${100 - width}vw` }}
        />
      )}

      {/* 侧边栏内容 */}
      <div
        ref={drawerRef}
        className="h-full flex flex-col"
      >
        {/* 拖拽手柄区域 */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-primary/50 dark:hover:bg-brand-primary/60 transition-colors group z-10"
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <GripVertical size={16} className="text-brand-primary dark:text-brand-primary/80" />
          </div>
        </div>

        {/* 头部操作栏 */}
        <div className="flex items-center justify-between px-md py-sm border-b border-subtle ml-1 flex-shrink-0">
          <div className="text-sm font-medium text-tertiary">详情面板</div>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={onClose}
            className="min-w-6 h-6"
          >
            <X size={16} />
          </Button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto min-h-0">
          <div className="p-md pl-lg">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
