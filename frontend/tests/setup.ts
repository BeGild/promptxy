/**
 * 测试环境设置文件
 * 配置全局测试环境和模拟
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { vi } from 'vitest';

// 每次测试后清理 DOM
afterEach(() => {
  cleanup();
});

// 模拟 ResizeObserver（react-window / react-resizable-panels 等依赖）
class ResizeObserverMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_callback?: ResizeObserverCallback) {}
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// @ts-expect-error - 测试环境注入
global.ResizeObserver = ResizeObserverMock;
// @ts-expect-error - 测试环境注入
window.ResizeObserver = ResizeObserverMock;

// 模拟全局对象
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// 模拟 EventSource
global.EventSource = class EventSource {
  url: string;
  readyState: number = 0;
  onopen: ((this: EventSource, ev: Event) => any) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => any) | null = null;
  onerror: ((this: EventSource, ev: Event) => any) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'request' && this.onmessage) {
      // 模拟请求事件
      setTimeout(() => {
        this.onmessage?.(
          new MessageEvent('message', {
            data: JSON.stringify({
              id: 'test-id',
              timestamp: Date.now(),
              client: 'claude',
              path: '/test',
              method: 'POST',
              matchedRules: ['rule-1'],
            }),
          }),
        );
      }, 20);
    }
  }

  close(): void {
    this.readyState = 2;
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {}
  dispatchEvent(event: Event): boolean {
    return true;
  }
};

// 模拟 localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// 模拟 URL.createObjectURL 和 URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
global.URL.revokeObjectURL = vi.fn();

// 模拟 document.createElement for file inputs
const originalCreateElement = document.createElement.bind(document);
document.createElement = function (tagName: string, options?: ElementCreationOptions) {
  const element = originalCreateElement(tagName, options);

  if (tagName === 'input') {
    Object.defineProperty(element, 'files', {
      writable: true,
      value: [],
    });
    Object.defineProperty(element, 'onchange', {
      writable: true,
      value: null,
    });
    Object.defineProperty(element, 'click', {
      writable: true,
      value: vi.fn(),
    });
  }

  return element;
};

// 模拟 FileReader
global.FileReader = class FileReader {
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  result: string | ArrayBuffer | null = null;

  readAsText(file: Blob): void {
    setTimeout(() => {
      if (this.onload) {
        this.result = '{"test": "config"}';
        this.onload(new ProgressEvent('load', { loaded: 100, total: 100 }));
      }
    }, 10);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {}
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {}
  dispatchEvent(event: Event): boolean {
    return true;
  }
};
