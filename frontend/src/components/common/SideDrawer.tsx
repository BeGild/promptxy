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
import { Button } from '@heroui/react';
import { X, GripVertical } from 'lucide-react';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  squeezeThreshold?: number;
  onModeChange?: (mode: 'squeeze' | 'overlay') => void;
  onWidthChange?: (width: number) => void;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  children,
  defaultWidth = 60,
  minWidth = 40,
  maxWidth = 90,
  squeezeThreshold = 60,
  onModeChange,
  onWidthChange,
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);

  // 当前是否为覆盖模式
  const isOverlay = width > squeezeThreshold;

  // 宽度变化时通知父组件
  useEffect(() => {
    onWidthChange?.(width);
    onModeChange?.(isOverlay ? 'overlay' : 'squeeze');
  }, [width, isOverlay, onWidthChange, onModeChange]);

  // 打开时重置宽度
  useEffect(() => {
    if (isOpen) {
      setWidth(defaultWidth);
    }
  }, [isOpen, defaultWidth]);

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
    if (!isResizing) return;

    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      rafId = requestAnimationFrame(() => {
        const newWidth = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setWidth(newWidth);
        }
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isResizing, minWidth, maxWidth]);

  // 计算内容层位置，支持开启动画
  const overlayLeft = isOpen
    ? isOverlay
      ? `${100 - width}vw`
      : `calc(100% - ${width}vw)`
    : '100%';

  // 统一结构，根据模式只改变样式，避免重绘
  return (
    <>
      {/* 外层容器 - 始终占据 flex 空间，支持动画 */}
      <div
        className="flex-shrink-0 relative transition-all duration-300 ease-out"
        style={{
          width: !isOpen || isOverlay ? '0px' : `${width}vw`,
        }}
      >
        {/* 底层透明层 - 挤压左侧内容 */}
        <div className="h-full" style={{ width: isOverlay ? '0px' : '100%' }} />
      </div>

      {/* 上层内容层 - 始终 fixed 定位，避开 Header，支持动画 */}
      <div
        className="h-full border-l border-subtle bg-canvas dark:bg-secondary shadow-xl transition-all duration-300 ease-out"
        style={{
          position: 'fixed',
          top: '56px',
          width: isOpen ? `${width}vw` : '0px',
          left: overlayLeft,
          zIndex: isOpen && isOverlay ? 50 : 'auto',
          height: 'calc(100vh - 56px)',
          opacity: isOpen ? 1 : 0,
          overflow: isOpen ? 'visible' : 'hidden',
        }}
      >
        {/* 拖拽手柄 */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-primary/50 dark:hover:bg-brand-primary/60 transition-colors group z-10"
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <GripVertical size={16} className="text-brand-primary dark:text-brand-primary/80" />
          </div>
        </div>

        {/* 头部 */}
        <div className="flex items-center justify-between px-md py-sm border-b border-subtle ml-1 flex-shrink-0">
          <div className="text-sm font-medium text-tertiary">详情面板</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-tertiary opacity-60">ESC 关闭</span>
            <Button isIconOnly size="sm" variant="light" onPress={onClose} className="min-w-6 h-6">
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* 内容 */}
        <div className="overflow-auto" style={{ height: 'calc(100% - 49px)' }}>
          <div className="p-md pl-lg">{children}</div>
        </div>
      </div>
    </>
  );
};
