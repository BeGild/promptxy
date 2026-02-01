/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 */

import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Spinner,
  Badge,
} from '@heroui/react';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useSyncLogs } from '@/hooks/useSync';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface SyncLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncLogsModal: React.FC<SyncLogsModalProps> = ({ isOpen, onClose }) => {
  const [typeFilter, setTypeFilter] = useState<'all' | 'price' | 'model'>('all');
  const { data: logsData, isLoading } = useSyncLogs(50, typeFilter === 'all' ? undefined : typeFilter);

  const logs = logsData?.logs || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 size={16} className="text-status-success" />;
      case 'failed':
        return <XCircle size={16} className="text-status-error" />;
      case 'running':
        return <Clock size={16} className="text-status-warning" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success':
        return '成功';
      case 'failed':
        return '失败';
      case 'running':
        return '进行中';
      default:
        return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'price':
        return '价格';
      case 'model':
        return '模型列表';
      case 'all':
        return '全部';
      default:
        return type;
    }
  };

  const formatTime = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: zhCN });
    } catch {
      return '未知时间';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      backdrop="blur"
      placement="center"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader>
          <div className="flex items-center justify-between w-full pr-6">
            <span>同步日志历史</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={typeFilter === 'all' ? 'solid' : 'flat'}
                color={typeFilter === 'all' ? 'primary' : 'default'}
                onPress={() => setTypeFilter('all')}
              >
                全部
              </Button>
              <Button
                size="sm"
                variant={typeFilter === 'price' ? 'solid' : 'flat'}
                color={typeFilter === 'price' ? 'primary' : 'default'}
                onPress={() => setTypeFilter('price')}
              >
                价格
              </Button>
              <Button
                size="sm"
                variant={typeFilter === 'model' ? 'solid' : 'flat'}
                color={typeFilter === 'model' ? 'primary' : 'default'}
                onPress={() => setTypeFilter('model')}
              >
                模型
              </Button>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Spinner color="primary">加载中...</Spinner>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-secondary">暂无同步日志</p>
            </div>
          ) : (
            <Table aria-label="同步日志" removeWrapper>
              <TableHeader>
                <TableColumn className="text-sm">时间</TableColumn>
                <TableColumn className="text-sm">类型</TableColumn>
                <TableColumn className="text-sm">状态</TableColumn>
                <TableColumn className="text-sm">消息</TableColumn>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{formatTime(log.startedAt)}</TableCell>
                    <TableCell>
                      <Badge color="primary" variant="flat" size="sm">
                        {getTypeLabel(log.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className={log.status === 'success' ? 'text-status-success' : log.status === 'failed' ? 'text-status-error' : 'text-status-warning'}>
                          {getStatusLabel(log.status)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.status === 'success' ? (
                        <span className="text-sm text-secondary">
                          同步成功: 更新了 {log.recordsCount} 个{log.type === 'price' ? '模型价格' : '模型'}
                        </span>
                      ) : (
                        <span className="text-sm text-status-error">
                          {log.errorMessage || '同步失败'}
                        </span>
                      )}
                      {(log.duration ?? 0) > 0 && (
                        <span className="text-xs text-tertiary ml-2">
                          ({log.duration}ms)
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="primary" variant="light" onPress={onClose}>
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
