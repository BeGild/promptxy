/**
 * 结构化错误类型
 *
 * 用于提供可定位、可追溯的错误信息
 */

/**
 * 错误类型
 */
export type TransformErrorType =
  | 'parse_error'
  | 'validation_error'
  | 'mapping_error'
  | 'sse_error'
  | 'invariant_violation'
  | 'missing_required'
  | 'type_mismatch'
  | 'invariant_violation';

/**
 * 转换错误
 */
export class TransformError extends Error {
  public readonly type: TransformErrorType;
  public readonly stepName: string;
  public readonly details: {
    missingPaths?: string[];
    invariant?: string;
    [key: string]: unknown;
  };

  constructor(
    type: TransformErrorType,
    stepName: string,
    message: string,
    details: {
      missingPaths?: string[];
      invariant?: string;
      [key: string]: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'TransformError';
    this.type = type;
    this.stepName = stepName;
    this.details = details;
  }

  /**
   * 创建验证错误
   */
  static validationError(
    stepName: string,
    message: string,
    missingPaths?: string[],
  ): TransformError {
    return new TransformError('validation_error', stepName, message, {
      missingPaths,
    });
  }

  /**
   * 创建不变量违规错误
   */
  static invariantViolation(
    stepName: string,
    message: string,
    invariant: string,
  ): TransformError {
    return new TransformError('invariant_violation', stepName, message, {
      invariant,
    });
  }

  /**
   * 创建映射错误
   */
  static mappingError(
    stepName: string,
    message: string,
    details: Record<string, unknown> = {},
  ): TransformError {
    return new TransformError('mapping_error', stepName, message, details);
  }

  /**
   * 创建 SSE 错误
   */
  static sseError(
    stepName: string,
    message: string,
    details: Record<string, unknown> = {},
  ): TransformError {
    return new TransformError('sse_error', stepName, message, details);
  }

  /**
   * 转换为可序列化的对象
   */
  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      stepName: this.stepName,
      message: this.message,
      details: this.details,
    };
  }
}
