/**
 * اختبار انحدار لقفلة «CreateConnection: Connection markznet_local already exists».
 *
 * يحاكي الطبقة الأصلية (Native) بإضافة SQLite مزيّفة تحتفظ بسجلّ اتصالاتها بين
 * «سياقات جافاسكربت» مختلفة (مثل إعادة تحميل WebView / Live Reload أو إعادة
 * محاولة تهيئة فاشلة)، ثم يتحقق أن acquireConnection في src/utils/sqliteClient.ts
 * يعتمد الاتصال الموجود بدلًا من رفضه وقفل التطبيق.
 *
 *   node scripts/test-connection-recovery.mjs
 */

import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = path.join(ROOT, ".output/tests/test-connection-recovery.mjs");
mkdirSync(path.dirname(outfile), { recursive: true });

await build({
  stdin: {
    resolveDir: ROOT,
    sourcefile: "entry.ts",
    loader: "ts",
    contents: `
      export { acquireConnection, DB_NAME } from ${JSON.stringify(path.join(ROOT, "src/utils/sqliteClient.ts"))};
      export { SQLiteConnection } from "@capacitor-community/sqlite";
    `,
  },
  bundle: true,
  outfile,
  format: "esm",
  platform: "node",
  target: "es2022",
  logLevel: "silent",
});

const { acquireConnection, DB_NAME, SQLiteConnection } = await import(outfile);

let passed = 0;
let failed = 0;
const ok = (cond, label) => {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
  }
};

/**
 * إضافة أصلية مزيّفة بنفس دلالات إضافة أندرويد: سجلّ اتصالات مستقل عن سجلّ
 * غلاف جافاسكربت، وcreateConnection يرفض باسم موجود مسبقًا.
 */
const createFakeNativePlugin = () => {
  const native = new Map(); // "RW_<name>" -> { open: boolean }
  const key = (o) => (o.readonly ? "RO_" : "RW_") + o.database;
  const plugin = {
    native,
    async createConnection(o) {
      if (native.has(key(o))) throw new Error(`Connection ${o.database} already exists`);
      native.set(key(o), { open: false });
    },
    async open(o) {
      const conn = native.get(key(o));
      if (!conn) throw new Error(`Open: No available connection for ${o.database}`);
      conn.open = true;
    },
    async execute(o) {
      const conn = native.get(key(o));
      if (!conn) throw new Error(`Execute: No available connection for ${o.database}`);
      if (!conn.open) throw new Error("Execute: database is not open");
      return { changes: { changes: 0 } };
    },
    async run(o) {
      await plugin.execute(o);
      return { changes: { changes: 0 } };
    },
    async query(o) {
      await plugin.execute(o);
      return { values: [] };
    },
    async closeConnection(o) {
      native.delete(key(o));
    },
    async isConnection(o) {
      return { result: native.has(key(o)) };
    },
  };
  return plugin;
};

console.log("اختبار الانحدار: اعتماد اتصال أصلي موجود (already exists)\n");

// 1) تهيئة أولى طبيعية: ينشأ الاتصال في الطبقة الأصلية.
const plugin = createFakeNativePlugin();
const realm1 = new SQLiteConnection(plugin);
const db1 = await acquireConnection(realm1);
await db1.open();
ok(plugin.native.has(`RW_${DB_NAME}`), "التهيئة الأولى تنشئ الاتصال في الطبقة الأصلية");
ok(db1.getConnectionDBName() === DB_NAME, "المقبض الأول مرتبط باسم القاعدة الصحيح");

// 2) نفس السياق يعيد استخدام الاتصال نفسه دون إنشاء جديد.
const db1b = await acquireConnection(realm1);
ok(db1b === db1, "نفس غلاف جافاسكربت يعيد استخدام المقبض نفسه");

// 3) الانحدار: سياق جافاسكربت جديد (سجلّ غلاف فارغ) والطبقة الأصلية ما تزال
//    تحتفظ بالاتصال — يجب الاعتماد لا الرفض برسالة already exists.
const realm2 = new SQLiteConnection(plugin);
let db2 = null;
let lockError = null;
try {
  db2 = await acquireConnection(realm2);
} catch (err) {
  lockError = err;
}
ok(lockError === null, "سياق جديد لا يُقفل برسالة CreateConnection ... already exists");
ok(db2 !== null, "سياق جديد يعتمد الاتصال الأصلي الموجود");

if (db2) {
  // المقبض المعتمد يعمل فعليًا ضد الطبقة الأصلية.
  let usable = true;
  try {
    await db2.open();
    await db2.execute("CREATE TABLE IF NOT EXISTS t (x INTEGER)", true);
  } catch {
    usable = false;
  }
  ok(usable, "المقبض المعتمد مفتوح وينفّذ الاستعلامات");

  // سجّل الغلاف الجديد صار متسقًا مع الطبقة الأصلية.
  const { result: known } = await realm2.isConnection(DB_NAME, false);
  ok(known === true, "سجلّ الغلاف الجديد يتسق بعد الاعتماد");

  const db2b = await acquireConnection(realm2);
  ok(db2b === db2, "المحاولات التالية في السياق الجديد تعيد المقبض المعتمد");
}

// 4) خطأ آخر غير already exists يجب أن يمرّ كما هو (لا ابتلاع للأخطاء).
const brokenPlugin = {
  async createConnection() {
    throw new Error("SQLite: فشل مختلف تمامًا");
  },
};
let propagated = null;
try {
  await acquireConnection(new SQLiteConnection(brokenPlugin));
} catch (err) {
  propagated = err;
}
ok(
  propagated !== null && String(propagated.message).includes("فشل مختلف"),
  "الأخطاء الأخرى تُمرَّر كما هي دون اعتماد زائف",
);

console.log(
  failed === 0
    ? `\nاختبار الانحدار: نجحت ${passed}/${passed} اختبارات ✓`
    : `\nاختبار الانحدار: ${failed} فشل و${passed} نجاح ✗`,
);
process.exit(failed === 0 ? 0 : 1);
