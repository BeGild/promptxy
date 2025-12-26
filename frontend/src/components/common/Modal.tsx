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
        base: 'border border-blue-200/50 dark:border-blue-800/30',
        backdrop: 'bg-black/50',
      }}
    >
      <ModalContent
        classNames={{
          base: 'border border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10',
        }}
      >
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
