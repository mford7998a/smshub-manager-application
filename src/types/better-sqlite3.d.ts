declare module 'better-sqlite3' {
  namespace Database {
    interface Database {
      prepare<T = any>(sql: string): Statement<T>;
      exec(sql: string): void;
      pragma(pragma: string, value?: any): any;
      close(): void;
      transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T;
    }

    interface Statement<T = any> {
      run(...params: any[]): RunResult;
      get(...params: any[]): T;
      all(...params: any[]): T[];
      iterate(...params: any[]): IterableIterator<T>;
      finalize(): void;
    }

    interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }

    interface Options {
      readonly?: boolean;
      fileMustExist?: boolean;
      timeout?: number;
      verbose?: (message?: any) => void;
    }
  }

  export default function(filename: string, options?: Database.Options): Database.Database;
} 