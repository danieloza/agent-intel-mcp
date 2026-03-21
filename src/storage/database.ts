import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config.js";
import type { DashboardHistoryPoint, ExtractedPattern, PatternCluster, RankedRepo, ScanSnapshot, SuggestionSnapshot } from "../types.js";

export class SqliteStore {
  private readonly db: Database.Database;

  constructor() {
    fs.mkdirSync(config.dataDir, { recursive: true });
    const dbPath = path.join(config.dataDir, "agent-intel.db");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scan_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scanned_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        source_repo TEXT,
        category TEXT NOT NULL,
        normalized TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS suggestion_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        generated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pattern_clusters (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dashboard_runs (
        recorded_at TEXT PRIMARY KEY,
        payload TEXT NOT NULL
      );
    `);
  }

  saveScanSnapshot(snapshot: ScanSnapshot): void {
    this.db
      .prepare("INSERT INTO scan_snapshots (scanned_at, payload) VALUES (?, ?)")
      .run(snapshot.scannedAt, JSON.stringify(snapshot));
  }

  savePatterns(patterns: ExtractedPattern[]): void {
    const insert = this.db.prepare(`
      INSERT INTO patterns (id, source_repo, category, normalized, payload)
      VALUES (@id, @sourceRepo, @category, @normalized, @payload)
      ON CONFLICT(id) DO UPDATE SET
        source_repo=excluded.source_repo,
        category=excluded.category,
        normalized=excluded.normalized,
        payload=excluded.payload
    `);

    const txn = this.db.transaction((items: ExtractedPattern[]) => {
      for (const item of items) {
        insert.run({
          id: item.id,
          sourceRepo: item.sourceRepo ?? null,
          category: item.category,
          normalized: item.normalized,
          payload: JSON.stringify(item),
        });
      }
    });

    txn(patterns);
  }

  saveSuggestionSnapshot(snapshot: SuggestionSnapshot): void {
    this.db
      .prepare("INSERT INTO suggestion_snapshots (generated_at, payload) VALUES (?, ?)")
      .run(snapshot.generatedAt, JSON.stringify(snapshot));
  }

  saveClusters(clusters: PatternCluster[]): void {
    const insert = this.db.prepare(`
      INSERT INTO pattern_clusters (id, payload)
      VALUES (@id, @payload)
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload
    `);

    const txn = this.db.transaction((items: PatternCluster[]) => {
      for (const item of items) {
        insert.run({
          id: item.id,
          payload: JSON.stringify(item),
        });
      }
    });

    txn(clusters);
  }

  saveDashboardRun(point: DashboardHistoryPoint): void {
    this.db
      .prepare(`
        INSERT INTO dashboard_runs (recorded_at, payload)
        VALUES (?, ?)
        ON CONFLICT(recorded_at) DO UPDATE SET payload=excluded.payload
      `)
      .run(point.recordedAt, JSON.stringify(point));
  }

  getLatestScanSnapshot(): ScanSnapshot | null {
    const row = this.db
      .prepare("SELECT payload FROM scan_snapshots ORDER BY id DESC LIMIT 1")
      .get() as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as ScanSnapshot) : null;
  }

  getLatestSuggestionSnapshot(): SuggestionSnapshot | null {
    const row = this.db
      .prepare("SELECT payload FROM suggestion_snapshots ORDER BY id DESC LIMIT 1")
      .get() as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as SuggestionSnapshot) : null;
  }

  getPatterns(limit = 100): ExtractedPattern[] {
    const rows = this.db
      .prepare("SELECT payload FROM patterns ORDER BY rowid DESC LIMIT ?")
      .all(limit) as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as ExtractedPattern);
  }

  getRankedReposFromLatestScan(): RankedRepo[] {
    return this.getLatestScanSnapshot()?.repos ?? [];
  }

  getClusters(limit = 50): PatternCluster[] {
    const rows = this.db
      .prepare("SELECT payload FROM pattern_clusters ORDER BY rowid DESC LIMIT ?")
      .all(limit) as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as PatternCluster);
  }

  getDashboardHistory(limit = 20): DashboardHistoryPoint[] {
    const rows = this.db
      .prepare("SELECT payload FROM dashboard_runs ORDER BY recorded_at DESC LIMIT ?")
      .all(limit) as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as DashboardHistoryPoint).reverse();
  }
}
