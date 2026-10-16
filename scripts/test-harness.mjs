/**
 * منصة اختبارات مشتركة — تحزّم وحدات TypeScript الحقيقية (storage/localDB/
 * localAuth/users/teacherPortal) في ملف JS واحد قابل للتشغيل داخل Node، مع
 * استبدال طبقة sqliteClient بستُبّ يعمل فوق sql.js في الذاكرة بنفس المخطط
 * الحقيقي المستخرج من src/utils/sqliteClient.ts، واستبدال mediaStore
 * (IndexedDB) بحافظة Blob في الذاكرة للاختبار.
 *
 * بهذا تُختبر الشيفرة الفعلية نفسها — لا نسخة معدّلة منها.
 */

import { build } from "esbuild";
import { readFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** يستخرج نص SCHEMA_SQL الحقيقي من ملف sqliteClient.ts (مصدر الحقيقة). */
export function extractSchemaSql() {
  const src = readFileSync(path.join(ROOT, "src/utils/sqliteClient.ts"), "utf8");
  const m = src.match(/const SCHEMA_SQL = `([\s\S]*?)`;/);
  if (!m) throw new Error("تعذّر استخراج SCHEMA_SQL من sqliteClient.ts");
  return m[1];
}

/**
 * ستُبّ sqliteClient فوق sql.js (نفس واجهة SQLiteDBConnection المستخدمة).
 *
 * يحاكي مخزن jeep-sqlite الدائم (IndexedDB على الويب): persist/persistNow
 * يُصدّران بايتات القاعدة إلى مخزن عام يعيش في globalThis، وgetDB يستردها عند
 * التهيئة — بحيث يمكن محاكاة «إعادة تحميل الصفحة» باستيراد نسخة جديدة من
 * الحزمة داخل نفس العملية والتحقق أن البيانات بقيت فعلًا.
 */
function sqliteStubSource(schemaSql) {
  return `
import initSqlJs from "sql.js";

const SCHEMA_SQL = ${JSON.stringify(schemaSql)};

const store = (globalThis.__MARKZ_TEST_SQL_STORE__ ??= new Map());

let dbPromise = null;

async function getSqlite() {
  if (!dbPromise) {
    dbPromise = initSqlJs().then((SQL) => {
      const saved = store.get(DB_NAME);
      const db = saved ? new SQL.Database(saved) : new SQL.Database();
      db.exec(SCHEMA_SQL);
      return db;
    });
  }
  return dbPromise;
}

function rowsToObjects(execResult) {
  if (!execResult || execResult.length === 0) return [];
  const { columns, values } = execResult[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

export const DB_NAME = "markznet_test";

export const getDB = async () => {
  const db = await getSqlite();
  return {
    query: async (sql, params = []) => ({ values: rowsToObjects(db.exec(sql, params)) }),
    run: async (sql, params = [], _tx = true) => {
      db.run(sql, params);
    },
    execute: async (sql, _tx = true) => {
      db.exec(sql);
    },
    executeSet: async (set = [], _tx = true) => {
      for (const item of set) {
        db.run(item.statement, item.values ?? []);
      }
    },
  };
};

export const persist = async () => {
  const db = await getSqlite();
  store.set(DB_NAME, db.export());
};
export const persistNow = persist;
`;
}

/** ستُبّ mediaStore بحافظة Blob في Node بدل IndexedDB الحقيقي. */
const MEDIA_STUB_SOURCE = `
const files = (globalThis.__MARKZ_TEST_MEDIA_FILES__ ??= new Map());
export const putMediaFile = async (key, file) => {
  files.set(key, file);
  return key;
};
export const getMediaFile = async (key) => files.get(key) ?? null;
export const makeMediaKey = (userId, ext) => {
  let key;
  do {
    key = userId + "/" + Date.now() + "_" + Math.random().toString(36).slice(2) + "." + ext;
  } while (files.has(key));
  return key;
};
export const getMediaObjectUrl = async () => null;
export const getMediaObjectUrls = async () => ({});
export const deleteMediaFile = async (key) => { files.delete(key); };
export const deleteMediaFiles = async (keys) => { keys.forEach((key) => files.delete(key)); };
export const __clearMediaFilesForTests = () => files.clear();
export const __getMediaFilesForTests = () => files;
`;

const SQLITE_STUB_ID = "\0virtual:sqlite-client";
const MEDIA_STUB_ID = "\0virtual:media-store";

function isSqliteClientImport(id, importer) {
  if (id === SQLITE_STUB_ID) return true;
  if (!importer) return false;
  return (
    /\.\/sqliteClient$/.test(id) ||
    /@\/utils\/sqliteClient$/.test(id) ||
    /[/\\]utils[/\\]sqliteClient$/.test(id)
  );
}

function isMediaStoreImport(id, importer) {
  if (id === MEDIA_STUB_ID) return true;
  if (!importer) return false;
  return (
    /\.\/mediaStore$/.test(id) ||
    /@\/utils\/mediaStore$/.test(id) ||
    /[/\\]utils[/\\]mediaStore$/.test(id)
  );
}

/**
 * يحزّم نقطة دخول (مسار ملف حقيقي أو شيفرة stdin) إلى outfile، مع:
 * - استبدال sqliteClient وmediaStore بالستُبّات أعلاه.
 * - دعم مسار الاسم المستعار @/ ← src/.
 * - إبقاء sql.js حزمة خارجية تُحمَّل من node_modules وقت التشغيل.
 */
export async function buildTestBundle({ entryFile, stdinSource, outfile }) {
  const schemaSql = extractSchemaSql();

  const plugin = {
    name: "markz-test-stubs",
    setup(builder) {
      builder.onResolve({ filter: /.*/ }, (args) => {
        if (isSqliteClientImport(args.path, args.importer))
          return { path: SQLITE_STUB_ID, namespace: "stub" };
        if (isMediaStoreImport(args.path, args.importer))
          return { path: MEDIA_STUB_ID, namespace: "stub" };
        if (args.path.startsWith("@/")) {
          const base = path.join(ROOT, "src", args.path.slice(2));
          const candidates = [
            base,
            `${base}.ts`,
            `${base}.tsx`,
            `${base}.js`,
            path.join(base, "index.ts"),
            path.join(base, "index.tsx"),
          ];
          for (const cand of candidates) {
            if (existsSync(cand) && statSync(cand).isFile()) return { path: cand };
          }
        }
        return null;
      });
      builder.onLoad({ filter: /.*/, namespace: "stub" }, (args) => {
        if (args.path === SQLITE_STUB_ID) {
          return { contents: sqliteStubSource(schemaSql), loader: "js", resolveDir: ROOT };
        }
        return { contents: MEDIA_STUB_SOURCE, loader: "js", resolveDir: ROOT };
      });
    },
  };

  mkdirSync(path.dirname(outfile), { recursive: true });

  const common = {
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    external: ["sql.js"],
    logLevel: "silent",
    plugins: [plugin],
    outfile,
  };

  if (stdinSource !== undefined) {
    await build({
      ...common,
      stdin: { contents: stdinSource, resolveDir: ROOT, loader: "js" },
    });
  } else {
    await build({ ...common, entryPoints: [entryFile] });
  }

  return outfile;
}

/** يهيّئ بيئة تشبه المتصفح (window + localStorage) قبل استيراد الحزمة. */
export function installBrowserShim() {
  const storage = new Map();
  if (!globalThis.window) {
    globalThis.window = {
      localStorage: {
        getItem: (k) => (storage.has(k) ? storage.get(k) : null),
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k),
        clear: () => storage.clear(),
        key: (i) => Array.from(storage.keys())[i] ?? null,
        get length() {
          return storage.size;
        },
      },
    };
  }
  return globalThis.window;
}

/** أدوات تأكيد بسيطة مع عدّادات ونتائج عربية. */
export function createTestRunner() {
  const results = [];
  const ok = (name, fn) =>
    Promise.resolve()
      .then(fn)
      .then(() => {
        results.push({ name, passed: true });
        console.log(`  ✓ ${name}`);
      })
      .catch((err) => {
        results.push({ name, passed: false, error: err });
        console.error(`  ✗ ${name}`);
        console.error(`    ${err?.stack || err}`);
      });

  const finish = (label) => {
    const failed = results.filter((r) => !r.passed);
    console.log(
      failed.length === 0
        ? `\n${label}: نجحت ${results.length}/${results.length} اختبارات ✓`
        : `\n${label}: فشلت ${failed.length}/${results.length} اختبارات ✗`,
    );
    if (failed.length > 0) process.exitCode = 1;
  };

  return { ok, finish };
}
