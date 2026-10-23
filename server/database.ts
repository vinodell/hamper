import { chmodSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  SqlDatabase,
  SqlResult,
  SqlStatement,
  SqlValue,
} from "./types.js";

class Statement implements SqlStatement {
  constructor(
    readonly database: SqliteDatabase,
    readonly sql: string,
    readonly values: SqlValue[] = [],
  ) {}

  bind(...values: SqlValue[]): SqlStatement {
    return new Statement(this.database, this.sql, values);
  }

  execute<T>(): SqlResult<T> {
    const results = this.database.connection
      .prepare(this.sql)
      .all(...this.values) as T[];
    return { success: true, results };
  }

  async all<T = Record<string, unknown>>(): Promise<SqlResult<T>> {
    return this.execute<T>();
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (
      (this.database.connection.prepare(this.sql).get(...this.values) as
        T | undefined) ?? null
    );
  }
}

/** One synchronous connection keeps each batch isolated until COMMIT/ROLLBACK. */
export class SqliteDatabase implements SqlDatabase {
  readonly connection: DatabaseSync;

  constructor(databasePath: string) {
    if (databasePath !== ":memory:") {
      mkdirSync(path.dirname(path.resolve(databasePath)), {
        recursive: true,
        mode: 0o700,
      });
    }
    this.connection = new DatabaseSync(databasePath);
    if (databasePath !== ":memory:") chmodSync(databasePath, 0o600);
    this.connection.exec(
      "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;",
    );
  }

  prepare(sql: string): SqlStatement {
    return new Statement(this, sql);
  }

  async batch<T = Record<string, unknown>>(
    statements: SqlStatement[],
  ): Promise<SqlResult<T>[]> {
    // Validate ownership before opening a transaction. Never await inside it:
    // another request must not interleave queries on this connection.
    const ownedStatements = statements.map((statement) => {
      if (!(statement instanceof Statement) || statement.database !== this) {
        throw new TypeError("Batch statements must use this database");
      }
      return statement;
    });
    this.connection.exec("BEGIN IMMEDIATE");
    try {
      const result = ownedStatements.map((statement) => statement.execute<T>());
      this.connection.exec("COMMIT");
      return result;
    } catch (error) {
      this.connection.exec("ROLLBACK");
      throw error;
    }
  }

  exec(sql: string): void {
    this.connection.exec(sql);
  }

  close(): void {
    this.connection.close();
  }
}
