import { validatePlotId, validatePlotUpdate } from "./plotValidation.js";
import { SqliteDatabase } from "./database.js";
import type { PlotRow } from "./types.js";

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
}

function decimal(value: unknown, unit: "area" | "price") {
  if (value === undefined || value === null) return value;
  const text =
    typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== "string") return text;
  const withoutUnits =
    unit === "area"
      ? text.trim().replace(/\s*сот(?:\.|ка|ки|ок)?$/iu, "")
      : text.trim().replace(/\s*(?:₽|руб(?:\.|лей)?|р\.)$/iu, "");
  return withoutUnits.replace(/\s/gu, "");
}

function databaseBoolean(value: unknown) {
  if (value === undefined) return undefined;
  if (value === 0 || value === 1) return value === 1;
  return value;
}

function field(
  row: Record<string, unknown>,
  camelCase: string,
  snakeCase: string,
) {
  return Object.hasOwn(row, camelCase) ? row[camelCase] : row[snakeCase];
}

function normalizePlot(value: unknown): PlotRow {
  const row = record(value, "plot");
  const id = validatePlotId(row.id);
  if (
    typeof row.settlement !== "string" ||
    !row.settlement.trim() ||
    row.settlement.length > 200
  )
    throw new Error(`Invalid settlement for plot ${id}`);
  const plot = validatePlotUpdate({
    ...row,
    area: decimal(row.area, "area"),
    price: decimal(row.price, "price"),
    fullPaymentPrice: decimal(
      field(row, "fullPaymentPrice", "full_payment_price"),
      "price",
    ),
    cadastralNumber: field(row, "cadastralNumber", "cadastral_number"),
    gpzuDone: Object.hasOwn(row, "gpzuDone")
      ? row.gpzuDone
      : databaseBoolean(row.gpzu_done),
    buildingPermitDone: Object.hasOwn(row, "buildingPermitDone")
      ? row.buildingPermitDone
      : databaseBoolean(row.building_permit_done),
    mortgageUrl: field(row, "mortgageUrl", "mortgage_url"),
  });
  const timestamp = field(row, "updatedAt", "updated_at");
  const updatedAt =
    timestamp === undefined ? new Date().toISOString() : timestamp;
  if (
    typeof updatedAt !== "string" ||
    !updatedAt.trim() ||
    updatedAt.length > 100 ||
    Number.isNaN(Date.parse(updatedAt))
  )
    throw new Error(`Invalid update timestamp for plot ${id}`);
  return {
    id,
    settlement: row.settlement.trim(),
    area: plot.area,
    price: plot.price,
    full_payment_price: plot.fullPaymentPrice ?? null,
    status: plot.status,
    street: plot.street ?? null,
    description: plot.description ?? null,
    cadastral_number: plot.cadastralNumber ?? null,
    gpzu_done: Number(plot.gpzuDone ?? false),
    building_permit_done: Number(plot.buildingPermitDone ?? false),
    mortgage_url: plot.mortgageUrl ?? null,
    updated_at: updatedAt,
  };
}

function normalizeSettings(value: unknown) {
  const source = record(value, "settings (export must include site settings)");
  const promotion =
    source.promotion === undefined
      ? source
      : record(source.promotion, "promotion");
  const enabled =
    promotion.enabled ?? databaseBoolean(promotion.promotion_enabled);
  const discount =
    promotion.discountPercent ?? promotion.promotion_discount_percent;
  if (
    typeof enabled !== "boolean" ||
    typeof discount !== "number" ||
    !Number.isInteger(discount) ||
    discount < 1 ||
    discount > 100
  )
    throw new Error("Invalid promotion settings");
  return { enabled: Number(enabled), discount };
}

function sqlStatements(input: string) {
  const statements: string[] = [];
  let current = "";
  let quote: string | null = null;
  let comment: "line" | "block" | null = null;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];
    if (comment === "line") {
      if (character === "\n") {
        comment = null;
        current += " ";
      }
      continue;
    }
    if (comment === "block") {
      if (character === "*" && next === "/") {
        comment = null;
        index += 1;
        current += " ";
      }
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) {
        if (next === quote) {
          current += next;
          index += 1;
        } else quote = null;
      }
      continue;
    }
    if (character === "-" && next === "-") {
      comment = "line";
      index += 1;
      current += " ";
    } else if (character === "/" && next === "*") {
      comment = "block";
      index += 1;
      current += " ";
    } else if (["'", '"', "`", "["].includes(character)) {
      quote = character === "[" ? "]" : character;
      current += character;
    } else if (character === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else current += character;
  }
  if (quote || comment === "block")
    throw new Error("Unterminated SQL quote or comment");
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function readSqlExport(input: string) {
  const temporary = new SqliteDatabase(":memory:");
  let ignoredStatements = 0;
  let inTrigger = false;
  const table =
    '(?:plots|site_settings|"(?:plots|site_settings)"|`(?:plots|site_settings)`|\\[(?:plots|site_settings)\\])';
  const create = new RegExp(
    `^CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}\\s*\\(`,
    "i",
  );
  const insert = new RegExp(
    `^INSERT\\s+(?:OR\\s+(?:REPLACE|IGNORE|ABORT|FAIL|ROLLBACK)\\s+)?INTO\\s+${table}(?=\\s|\\()`,
    "i",
  );
  try {
    for (const statement of sqlStatements(input)) {
      if (inTrigger) {
        ignoredStatements += 1;
        if (/^END$/i.test(statement)) inTrigger = false;
        continue;
      }
      if (/^CREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\b/i.test(statement)) {
        inTrigger = true;
        ignoredStatements += 1;
      } else if (create.test(statement) || insert.test(statement)) {
        // Only these two tables can be constructed in this disposable database.
        // Dump SQL is never executed against the application database.
        temporary.exec(statement);
      } else ignoredStatements += 1;
    }
    const plots = temporary.connection.prepare("SELECT * FROM plots").all();
    const settings = temporary.connection
      .prepare("SELECT * FROM site_settings")
      .all();
    if (settings.length !== 1 || settings[0].id !== 1)
      throw new Error(
        "SQL export must contain exactly one site_settings row with id 1",
      );
    return { source: { plots, settings: settings[0] }, ignoredStatements };
  } finally {
    temporary.close();
  }
}

export function importData(database: SqliteDatabase, input: string) {
  const text = input.replace(/^\uFEFF/, "").trim();
  const sql =
    text.startsWith("{") || text.startsWith("[") ? null : readSqlExport(text);
  const parsed: unknown = sql ? sql.source : JSON.parse(text);
  const source = record(parsed, "export");
  if (!Array.isArray(source.plots))
    throw new Error("Export must include plots array");
  const plots = source.plots.map(normalizePlot);
  if (new Set(plots.map(({ id }) => id)).size !== plots.length)
    throw new Error("Duplicate plot identifiers in export");
  const settings = normalizeSettings(source.settings);
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(
      "CREATE TABLE IF NOT EXISTS _data_imports (id INTEGER PRIMARY KEY CHECK(id = 1), imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
    const existing = database.connection
      .prepare(
        "SELECT (SELECT COUNT(*) FROM plots) AS plots, (SELECT COUNT(*) FROM inquiries) AS inquiries, (SELECT COUNT(*) FROM _data_imports) AS imports",
      )
      .get();
    const baseline = database.connection
      .prepare(
        "SELECT promotion_enabled, promotion_discount_percent FROM site_settings WHERE id = 1",
      )
      .get();
    if (
      !existing ||
      existing.plots !== 0 ||
      existing.inquiries !== 0 ||
      existing.imports !== 0 ||
      !baseline ||
      baseline.promotion_enabled !== 1 ||
      baseline.promotion_discount_percent !== 10
    )
      throw new Error(
        "Target database is not empty or was already imported; refusing to overwrite data",
      );
    const insert = database.connection.prepare(
      "INSERT INTO plots (id, settlement, area, status, price, full_payment_price, street, description, cadastral_number, gpzu_done, building_permit_done, mortgage_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const plot of plots)
      insert.run(
        plot.id,
        plot.settlement,
        plot.area,
        plot.status,
        plot.price,
        plot.full_payment_price,
        plot.street,
        plot.description,
        plot.cadastral_number,
        plot.gpzu_done,
        plot.building_permit_done,
        plot.mortgage_url,
        plot.updated_at,
      );
    database.connection
      .prepare(
        "UPDATE site_settings SET promotion_enabled = ?, promotion_discount_percent = ? WHERE id = 1",
      )
      .run(settings.enabled, settings.discount);
    database.exec("INSERT INTO _data_imports (id) VALUES (1)");
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return {
    plots: plots.length,
    ignoredStatements: sql?.ignoredStatements ?? 0,
  };
}
