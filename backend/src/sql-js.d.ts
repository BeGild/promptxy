declare module 'sql.js' {
  export interface QueryResult {
    columns: string[];
    values: any[][];
  }

  export interface BindParams {
    [key: string]: any;
  }

  export class Database {
    constructor(buffer?: Uint8Array);

    exec(sql: string, bindParams?: BindParams): QueryResult[];
    run(sql: string, bindParams?: BindParams): void;
    prepare(sql: string): Statement;
    getRowsModified(): number;
    export(): Uint8Array;
    close(): void;
  }

  export class Statement {
    bind(bindParams?: BindParams | any[]): void;
    step(): boolean;
    getAsObject(): { [key: string]: any };
    free(): void;
  }

  export interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<{
    Database: typeof Database;
    Statement: typeof Statement;
  }>;
}