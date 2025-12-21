/**
 * ErrorBoundary - React 错误边界组件
 * 捕获子组件树中的 JavaScript 错误并显示友好的错误 UI
 *
 * 特性：
 * - 捕获渲染错误、生命周期错误、构造函数错误
 * - 开发环境显示详细错误信息和堆栈
 * - 生产环境显示友好错误提示
 * - 提供重试机制
 * - 支持自定义错误 UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Card, CardBody } from '@heroui/react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// 开发环境检测
const isDevelopment = import.meta.env?.DEV ?? false;

// 默认错误 UI 组件
const DefaultErrorUI: React.FC<{
  error: Error;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}> = ({ error, errorInfo, onReset }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="max-w-2xl w-full border-2 border-danger-500 bg-white dark:bg-gray-900">
        <CardBody className="p-6 space-y-4">
          {/* 标题区域 */}
          <div className="text-center space-y-2">
            <div className="text-6xl">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">出现了意外错误</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              应用程序遇到了问题，我们的工程师正在努力修复
            </p>
          </div>

          {/* 错误详情（仅开发环境） */}
          {isDevelopment && error && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 space-y-3 text-xs font-mono overflow-auto max-h-64">
              <div className="space-y-1">
                <div className="font-bold text-danger-600">错误信息:</div>
                <div className="text-gray-800 dark:text-gray-200">{error.message}</div>
              </div>

              {error.stack && (
                <div className="space-y-1">
                  <div className="font-bold text-warning-600">堆栈跟踪:</div>
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {error.stack}
                  </div>
                </div>
              )}

              {errorInfo?.componentStack && (
                <div className="space-y-1">
                  <div className="font-bold text-primary-600">组件堆栈:</div>
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {errorInfo.componentStack}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 生产环境友好提示 */}
          {!isDevelopment && (
            <div className="bg-warning-100 dark:bg-warning-900/20 rounded-lg p-3 text-sm text-warning-800 dark:text-warning-200">
              <p>💡 提示：如果这个问题持续出现，请尝试刷新页面或联系技术支持。</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 justify-center pt-2">
            <Button
              color="primary"
              onPress={onReset}
              className="shadow-md hover:shadow-lg transition-shadow"
              radius="lg"
              size="lg"
            >
              🔄 重试
            </Button>
            <Button
              color="secondary"
              onPress={() => window.location.reload()}
              variant="flat"
              radius="lg"
              size="lg"
            >
              🔄 刷新页面
            </Button>
          </div>

          {/* 开发环境额外信息 */}
          {isDevelopment && (
            <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
              开发模式：错误详情已显示上方
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

/**
 * ErrorBoundary 类组件
 * 兼容 React 18，支持类组件错误捕获
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  // 静态方法用于错误捕获
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // 更新状态以便下一次渲染显示降级 UI
    return {
      hasError: true,
      error: error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误信息
    this.setState({
      errorInfo: errorInfo,
    });

    // 调用用户提供的错误处理回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 在开发环境下打印详细错误
    if (isDevelopment) {
      console.error('🚨 ErrorBoundary 捕获到错误:', {
        error,
        componentStack: errorInfo.componentStack,
      });
    }

    // 可以在这里发送错误到监控服务
    // 例如：Sentry, LogRocket 等
    this.reportErrorToService(error, errorInfo);
  }

  /**
   * 报告错误到监控服务
   */
  private reportErrorToService(error: Error, errorInfo: ErrorInfo): void {
    // 这里可以集成错误监控服务
    // 例如：Sentry.captureException(error, { extra: errorInfo });

    // 在开发环境记录模拟上报
    if (isDevelopment) {
      console.log('📊 错误已准备上报到监控服务 (模拟)', { error, errorInfo });
    }
  }

  /**
   * 重置错误状态
   */
  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // 调用用户提供的重置回调
    if (this.props.onReset) {
      this.props.onReset();
    }

    if (isDevelopment) {
      console.log('✅ 错误状态已重置');
    }
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // 如果提供了自定义错误 UI，使用自定义的
      if (fallback) {
        return fallback;
      }

      // 否则使用默认错误 UI
      return <DefaultErrorUI error={error} errorInfo={errorInfo} onReset={this.handleReset} />;
    }

    return children;
  }
}

/**
 * 包装函数 - 用于函数组件中使用错误边界
 * 注意：这只捕获包装组件内的错误，不能替代 ErrorBoundary 组件
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void,
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const WithErrorBoundary: React.FC<P> = props => {
    return (
      <ErrorBoundary fallback={fallback} onError={onError}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WithErrorBoundary;
}

/**
 * 自定义错误 UI 组件
 * 用于创建特定场景的错误界面
 */
export const CustomErrorUI: React.FC<{
  icon?: string;
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  error?: Error;
  showDetails?: boolean;
}> = ({
  icon = '⚠️',
  title = '出错了',
  description = '操作未能完成，请稍后重试',
  actionText = '重试',
  onAction,
  error,
  showDetails = isDevelopment,
}) => {
  return (
    <div className="flex items-center justify-center min-h-full p-4">
      <Card className="max-w-lg w-full border-2 border-danger-500 bg-white dark:bg-gray-900">
        <CardBody className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="text-5xl">{icon}</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
          </div>

          {showDetails && error && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-xs font-mono overflow-auto max-h-40">
              <div className="font-bold mb-1">错误详情:</div>
              <div className="text-gray-700 dark:text-gray-300">{error.message}</div>
              {error.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-gray-500">堆栈信息</summary>
                  <pre className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-400">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}

          {onAction && (
            <div className="flex justify-center pt-2">
              <Button color="danger" onPress={onAction} variant="flat" radius="lg" size="md">
                {actionText}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default ErrorBoundary;
