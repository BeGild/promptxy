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

import React, { ReactNode } from 'react';
import {
  Modal as HeroModal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  backdrop?: 'opaque' | 'blur' | 'transparent';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'lg',
  backdrop = 'blur',
}) => {
  return (
    <HeroModal
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      backdrop={backdrop}
      placement="center"
      scrollBehavior="outside"
      classNames={{
        base: 'border border-brand-primary/30 dark:border-brand-primary/20 bg-canvas dark:bg-secondary',
        backdrop: 'bg-overlay',
        header: 'bg-canvas dark:bg-secondary border-b border-subtle',
        body: 'bg-canvas dark:bg-secondary',
        footer: 'bg-canvas dark:bg-secondary border-t border-subtle',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader>{title}</ModalHeader>
            <ModalBody>{children}</ModalBody>
            {footer && <ModalFooter>{footer}</ModalFooter>}
          </>
        )}
      </ModalContent>
    </HeroModal>
  );
};
