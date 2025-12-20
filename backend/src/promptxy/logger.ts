type LogLevel = "silent" | "info" | "debug";

export type PromptxyLogger = {
  info: (message: string) => void;
  debug: (message: string) => void;
};

function levelFromConfig(debug: boolean): LogLevel {
  if (debug) return "debug";
  return "info";
}

export function createLogger(options: { debug: boolean }): PromptxyLogger {
  const level = levelFromConfig(options.debug);

  const info = (message: string) => {
    if (level === "silent") return;
    // eslint-disable-next-line no-console
    console.log(message);
  };

  const debug = (message: string) => {
    if (level !== "debug") return;
    // eslint-disable-next-line no-console
    console.log(message);
  };

  return { info, debug };
}
