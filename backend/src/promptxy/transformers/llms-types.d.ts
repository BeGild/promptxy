/**
 * @musistudio/llms 类型声明
 *
 * 临时类型声明，待官方类型发布后可移除
 */

declare module '@musistudio/llms' {
  export interface LLMTransformer {
    name: string;
    transformRequest?: (request: any, options?: any) => Promise<any>;
    transformResponse?: (response: any, options?: any) => Promise<any>;
  }

  export interface TransformOptions {
    [key: string]: any;
  }

  export function transformRequest(
    transformerName: string,
    request: any,
    options?: TransformOptions,
  ): Promise<any>;

  export function transformResponse(
    transformerName: string,
    response: any,
    options?: TransformOptions,
  ): Promise<any>;
}
