type LogLevel = 'silent' | 'info' | 'debug';

export type PromptxyLogger = {
  info: (message: string) => void;
  debug: (message: string) => void;
  error: (message: string) => void;
  debugEnabled: boolean;
};

function levelFromConfig(debug: boolean): LogLevel {
  if (debug) return 'debug';
  return 'info';
}

export function createLogger(options: { debug: boolean }): PromptxyLogger {
  const level = levelFromConfig(options.debug);

  const info = (message: string) => {
    if (level === 'silent') return;

    console.log(message);
  };

  const debug = (message: string) => {
    if (level !== 'debug') return;

    console.log(message);
  };

  const error = (message: string) => {
    // error 方法始终输出到 stderr，不受 debug 配置影响
    console.error('[ERROR]', message);
  };

  return { info, debug, error, debugEnabled: level === 'debug' };
}
