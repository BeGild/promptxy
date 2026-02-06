import sqlite3 from 'sqlite3';

export type SqliteParams = readonly unknown[] | undefined;

export class SqliteDb {
  constructor(private readonly db: sqlite3.Database) {}

  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  run(sql: string, params: SqliteParams = undefined): Promise<{ changes: number; lastID: number }> {
    return new Promise((resolve, reject) => {
      const callback = function (this: sqlite3.RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      };

      if (params && params.length > 0) this.db.run(sql, params as any, callback);
      else this.db.run(sql, callback);
    });
  }

  get<T>(sql: string, params: SqliteParams = undefined): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const cb = (err: Error | null, row: T) => {
        if (err) reject(err);
        else resolve(row);
      };

      if (params && params.length > 0) this.db.get(sql, params as any, cb as any);
      else this.db.get(sql, cb as any);
    });
  }

  all<T>(sql: string, params: SqliteParams = undefined): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const cb = (err: Error | null, rows: T[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      };

      if (params && params.length > 0) this.db.all(sql, params as any, cb);
      else this.db.all(sql, cb);
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export async function openSqliteDb(filePath: string): Promise<SqliteDb> {
  const db = await new Promise<sqlite3.Database>((resolve, reject) => {
    const instance = new sqlite3.Database(filePath, err => {
      if (err) reject(err);
      else resolve(instance);
    });
  });
  return new SqliteDb(db);
}

