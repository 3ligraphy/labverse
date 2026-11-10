/** The parts of sql.js (SQLite in WebAssembly) the SQL runner uses. */
declare module 'sql.js' {
  export interface Statement {
    getSQL(): string;
    getColumnNames(): string[];
    step(): boolean;
    get(): unknown[];
    free(): boolean;
  }
  export interface Database {
    iterateStatements(sql: string): Iterable<Statement>;
    getRowsModified(): number;
    close(): void;
  }
  export interface SqlJsStatic {
    Database: new () => Database;
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}
