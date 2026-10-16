/**
 * اختبار تخطيط القائمة الجانبية (انحدار «القائمة لا تختفي عند الاختيار»).
 *
 * العلّة الأصلية: كانت القائمة تُثبَّت بـ Tailwind من 768px (`md:translate-x-0`)
 * بينما زر الفتح/الإغلاق العائم كان `md:hidden` ومساحة التخطيط `md:mr-72`، فبقيت
 * القائمة ظاهرة فوق المحتوى على الأجهزة اللوحية والشاشات المتوسطة (768–1279px)
 * بلا أي سبيل لإغلاقها، ولم تختفِ عند اختيار صفحة.
 *
 * الاختبار يعمل على شيفرة التطبيق نفسها لا على نسخة منها:
 *   1) فحوص بنيوية على المصادر: نقطة تثبيت واحدة (1280px) يقرأها القائمة
 *      والتخطيط، ولا تبقى أدوات تثبيت مكتوبة داخل القائمة.
 *   2) فحوص سلوكية حقيقية: يُركَّب AppSidebar الفعلي فوق DOM (jsdom) ويُتفاعل
 *      معه كما يفعل المستخدم — فتح، اختيار صفحة، Esc، الحاجب، زر الإغلاق،
 *      تغيّر المسار، وتغيّر عرض الشاشة — ثم يُركَّب التخطيط المُصدَّق للتحقق من
 *      أن حجز المساحة (`mr-72`) صار مشروطاً بالتثبيت.
 *
 *   node scripts/test-layout.mjs
 */

import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, ".output/tests");

let passed = 0;
let failed = 0;
const ok = (cond, label, detail) => {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
    if (detail !== undefined) console.log(`    ${detail}`);
  }
};

const readSource = (relative) => readFileSync(path.join(ROOT, relative), "utf8");

/** تجريد التعليقات قبل الفحص البنيوي: الشرح قد يذكر الأدوات القديمة عمداً. */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** كل ملفات المصادر (ts/tsx) تحت مجلد — لفحص عدم تكرار أرقام التخطيط. */
const collectSourceFiles = (dir) => {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...collectSourceFiles(full));
    else if (/\.tsx?$/.test(entry)) files.push(full);
  }
  return files;
};

// ============================================================
// 1) فحوص بنيوية على المصادر
// ============================================================
console.log("اختبار تخطيط القائمة الجانبية (تثبيت من 1280px + درج يُغلق)\n");
console.log("1) نقطة التثبيت الواحدة في المصادر:");

const dockSource = stripComments(readSource("src/hooks/useSidebarDock.ts"));
const sidebarSource = stripComments(readSource("src/components/AppSidebar.tsx"));
const routeSource = stripComments(readSource("src/routes/_authenticated/route.tsx"));
const tabsSource = stripComments(readSource("src/components/CenterSectionTabs.tsx"));
const examSource = stripComments(readSource("src/pages/ExamQuestions.tsx"));
const settingsSource = stripComments(readSource("src/pages/Settings.tsx"));
const packageJson = JSON.parse(readSource("package.json"));

const breakpointMatch = dockSource.match(/SIDEBAR_DOCK_BREAKPOINT\s*=\s*(\d+)/);
ok(
  breakpointMatch !== null && Number(breakpointMatch[1]) === 1280,
  "src/hooks/useSidebarDock.ts يعرّف SIDEBAR_DOCK_BREAKPOINT = 1280",
  breakpointMatch ? `القيمة المكتشفة: ${breakpointMatch[1]}` : "لم يُعثر على الثابت",
);
ok(
  /DOCK_MEDIA_QUERY\s*=\s*`\(min-width: \$\{SIDEBAR_DOCK_BREAKPOINT\}px\)`/.test(dockSource),
  "استعلام الوسائط يُبنى من الثابت نفسه (لا رقم مكرر)",
);
ok(
  /export function useSidebarDock\(\)/.test(dockSource),
  "الخطاف useSidebarDock مُصدَّر للاستخدام في القائمة والتخطيط",
);
ok(
  /from "@\/hooks\/useSidebarDock"/.test(sidebarSource) && /useSidebarDock\(\)/.test(sidebarSource),
  "AppSidebar يقرأ نقطة التثبيت من useSidebarDock",
);
ok(
  /from "@\/hooks\/useSidebarDock"/.test(routeSource) &&
    /const sidebarDocked = useSidebarDock\(\)/.test(routeSource),
  "التخطيط المُصدَّق يقرأ نقطة التثبيت نفسها",
);
ok(
  /className=\{`min-h-screen min-w-0 \$\{sidebarDocked \? "mr-72" : ""\}`\}/.test(routeSource),
  'حجز المساحة صار مشروطاً: sidebarDocked ? "mr-72" : ""',
);
ok(!/md:mr-72|lg:mr-72/.test(routeSource), "لا تثبيت مكتوب بـ md:/lg: في التخطيط (نقطة واحدة فقط)");

console.log("\n2) القائمة الجانبية لم تعد مثبّتة بـ Tailwind:");

const sidebarBreakpoints = [...sidebarSource.matchAll(/\b(sm|md|lg|xl|2xl):/g)].map((m) => m[0]);
const remainingBreakpoints = [...new Set(sidebarBreakpoints)].join("، ") || "لا شيء";
ok(
  !/\b(md|lg):translate-x-0/.test(sidebarSource),
  "حُذف md:/lg:translate-x-0 من القائمة",
  `بقيت الأدوات: ${remainingBreakpoints}`,
);
ok(
  !/\b(sm|md|lg):/.test(sidebarSource),
  "لا تبقى أي نقطة توقف مكتوبة داخل القائمة (القرار كله من useSidebarDock)",
  `بقيت الأدوات: ${remainingBreakpoints}`,
);
ok(
  collectSourceFiles(path.join(ROOT, "src")).every(
    (file) => !/md:mr-72|lg:mr-72/.test(stripComments(readFileSync(file, "utf8"))),
  ),
  "لا يوجد حجز مساحة مكتوب يدوياً في أي ملف آخر تحت src/",
);

console.log("\n3) مسافات زر القائمة العائم وبطاقات الإعدادات:");

ok(
  /pr-12 text-sm font-bold text-muted-foreground xl:pr-0/.test(tabsSource),
  "CenterSectionTabs: pr-12 xl:pr-0 (النص لا يقع تحت الزر العائم)",
);
ok(
  /p-6 pt-16 text-white xl:pt-6/.test(examSource),
  "ExamQuestions: pt-16 xl:pt-6 (الترويسة تنزل تحت الزر العائم)",
);
ok(
  /grid gap-3 sm:grid-cols-2 xl:grid-cols-4/.test(settingsSource),
  "بطاقات ملخص الإعدادات: xl:grid-cols-4",
);
ok(
  packageJson.scripts?.["test:layout"] === "node scripts/test-layout.mjs",
  "npm run test:layout مسجَّل في package.json",
);

// ============================================================
// 2) بيئة DOM حقيقية (jsdom) + محاكاة تغيّر عرض الشاشة
// ============================================================
console.log("\n4) سلوك القائمة الفعلي فوق DOM (jsdom):");

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

for (const key of [
  "window",
  "document",
  "location",
  "history",
  "localStorage",
  "sessionStorage",
  "HTMLElement",
  "HTMLInputElement",
  "SVGElement",
  "Element",
  "Node",
  "NodeList",
  "Event",
  "CustomEvent",
  "KeyboardEvent",
  "MouseEvent",
  "MutationObserver",
  "CSSStyleDeclaration",
  "DOMRect",
  "screen",
]) {
  const value = dom.window[key];
  if (value === undefined) continue;
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
try {
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });
} catch {
  /* Node يعرّف navigator بنفسه في بعض الإصدارات — window.navigator متاح على أي حال */
}
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * محاكاة matchMedia متحكَّم بها: يقرأ الخطاف قيمة matches، ويمكن للاختبار أن
 * «يغيّر عرض الشاشة» فيُبلَّغ المشتركون كما يفعل المتصفح الحقيقي.
 */
let viewportMatchesDock = false;
const viewportListeners = new Set();
dom.window.matchMedia = (query) => ({
  media: query,
  get matches() {
    return viewportMatchesDock;
  },
  onchange: null,
  addEventListener: (_type, listener) => viewportListeners.add(listener),
  removeEventListener: (_type, listener) => viewportListeners.delete(listener),
  addListener: (listener) => viewportListeners.add(listener),
  removeListener: (listener) => viewportListeners.delete(listener),
  dispatchEvent: () => false,
});

/** يغيّر عرض الشاشة أمام الخطاف كما يفعل المتصفح عند التصغير/التكبير. */
const setViewport = (docked) => {
  viewportMatchesDock = docked;
  for (const listener of [...viewportListeners]) {
    listener({ matches: docked, media: "(min-width: 1280px)" });
  }
};

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act, createElement } = React;

globalThis.__MARKZ_TEST_PATHNAME__ = "/";

// ============================================================
// 3) تحزيم المكوّنات الحقيقية مع بدائل لطبقات المصادقة/التوجيه
// ============================================================
const stubs = new Map([
  [
    "@/lib/router-compat",
    `import { createElement } from "react";
export const Link = ({ to, children, onClick, ...rest }) =>
  createElement(
    "a",
    {
      href: to,
      "data-to": to,
      ...rest,
      // مثل روابط الموجّه الحقيقي: لا تنقّل فعلي داخل الصفحة، والحادث يمر للمكوّن.
      onClick: (event) => {
        event.preventDefault();
        if (onClick) onClick(event);
      },
    },
    children,
  );
export const useLocation = () => ({ pathname: globalThis.__MARKZ_TEST_PATHNAME__ || "/" });
export const useNavigate = () => () => {};
export const useSearchParams = () => [new URLSearchParams()];
`,
  ],
  [
    "@/hooks/useAuth",
    `export const useAuth = () => ({
  user: { id: "test-user", name: "مستخدم الاختبار", email: null },
  loading: false,
  isAdmin: false,
  sharedWithMe: [],
  viewAs: null,
  setViewAs: () => {},
  signOut: async () => {},
});
`,
  ],
  [
    "@/hooks/useCenterBrand",
    `export const useCenterBrand = () => ({
  identity: { name: "مركز الاختبار", supervisor: "قسم القرآن الكريم", logo: null },
  name: "مركز الاختبار",
  headerLine: "مركز الاختبار — نسخة بلا إنترنت · قسم القرآن الكريم",
  logoUrl: "data:image/png;base64,iVBORw0KGgo=",
  hasCustomLogo: false,
  isCustomized: false,
  loading: false,
  saving: false,
  save: async () => {},
  reset: async () => {},
  refresh: async () => {},
});
`,
  ],
  ["@/components/ViewAsBanner", `export const ViewAsBanner = () => null;`],
  ["@/components/CenterSectionTabs", `export const CenterSectionTabs = () => null;`],
  ["@/utils/localAuth", `export const getSessionUser = async () => ({ id: "test-user" });`],
  ["@/utils/sqliteClient", `export const getDB = async () => ({});`],
  [
    "@tanstack/react-router",
    `export const Outlet = () => null;
export const redirect = (options) => options;
export const createFileRoute = () => (options) => ({ options });
`,
  ],
]);

const createStubPlugin = (activeStubs) => ({
  name: "markz-layout-stubs",
  setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) => {
      if (activeStubs.has(args.path)) return { path: args.path, namespace: "stub" };
      if (args.path.startsWith("@/")) {
        const base = path.join(ROOT, "src", args.path.slice(2));
        for (const candidate of [
          base,
          `${base}.ts`,
          `${base}.tsx`,
          path.join(base, "index.ts"),
          path.join(base, "index.tsx"),
        ]) {
          if (existsSync(candidate) && statSync(candidate).isFile()) return { path: candidate };
        }
      }
      return null;
    });
    builder.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({
      contents: activeStubs.get(args.path),
      loader: "js",
      resolveDir: ROOT,
    }));
  },
});

const buildBundle = async (name, entrySource, activeStubs) => {
  mkdirSync(OUT_DIR, { recursive: true });
  const outfile = path.join(OUT_DIR, `${name}.mjs`);
  await build({
    stdin: { contents: entrySource, resolveDir: ROOT, loader: "ts", sourcefile: "entry.ts" },
    bundle: true,
    format: "esm",
    jsx: "automatic",
    platform: "node",
    target: "node22",
    external: [
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "react-dom/server",
      "lucide-react",
    ],
    loader: { ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl", ".css": "empty" },
    plugins: [createStubPlugin(activeStubs)],
    outfile,
    logLevel: "silent",
  });
  return outfile;
};

// حزمة القائمة: تُبنى من ملف AppSidebar الحقيقي (بلا استبداله).
const sidebarBundle = await buildBundle(
  "test-layout-sidebar",
  `export { AppSidebar } from "@/components/AppSidebar";`,
  new Map([...stubs].filter(([key]) => key !== "@/components/AppSidebar")),
);
// حزمة التخطيط: الملف الحقيقي للسجل المُصدَّق، مع استبدال الأبناء حتى لا
// نحتاج قاعدة بيانات أو موجّه حقيقي — المقصود هنا قياس `mr-72` وحدها.
const layoutBundle = await buildBundle(
  "test-layout-route",
  `export { Route } from "@/routes/_authenticated/route";`,
  new Map([...stubs, ["@/components/AppSidebar", `export const AppSidebar = () => null;`]]),
);

const { AppSidebar } = await import(sidebarBundle);
// التخطيط يُقرأ من خيارات المسار نفسها كما يقرأه الموجّه (بلا تصدير إضافي
// في ملف المسار — تصدير المكوّنات هناك يكسر تحويل TanStack Start).
const { Route: authenticatedRoute } = await import(layoutBundle);
const AuthenticatedLayout = authenticatedRoute.options.component;

/** يركّب مكوّناً حقيقياً في DOM ويعيد أدوات إعادة الرسم والتنظيف. */
const mount = async (Component) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = async () =>
    act(async () => {
      root.render(createElement(Component));
    });
  await render();
  return {
    container,
    render,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
};

const isInert = (el) => el.hasAttribute("inert") || el.inert === true;
const hasClass = (el, name) => el.className.split(/\s+/).includes(name);

// ---------- الدرج أدنى من 1280px ----------
setViewport(false); // شاشة متوسطة (أدنى من 1280px) قبل أول تركيب
const sidebar = await mount(AppSidebar);
const aside = sidebar.container.querySelector("aside");
const trigger = () => sidebar.container.querySelector('button[aria-controls="app-sidebar"]');
const backdrop = () => sidebar.container.querySelector('div[aria-hidden="true"].fixed');
const closeButton = () => aside.querySelector('button[aria-label="إغلاق القائمة الجانبية"]');
const pressEscape = async () => {
  await act(async () => {
    document.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
};
const openDrawer = async () => {
  await act(async () => trigger().click());
};

ok(aside !== null, "القائمة تُرسم فعلياً في الصفحة");
ok(
  aside !== null && hasClass(aside, "translate-x-full") && isInert(aside),
  "وهي مخفية: translate-x-full مع inert (لا تركيز ولا نقر خارج الشاشة)",
  aside ? `class="${aside.className}" — inert=${isInert(aside)}` : "",
);
ok(
  trigger() !== null && trigger().getAttribute("aria-expanded") === "false",
  "زر الفتح العائم ظاهر ومغلق الحالة",
);

await openDrawer();
ok(
  !isInert(aside) && hasClass(aside, "translate-x-0") && !hasClass(aside, "translate-x-full"),
  "النقر على الزر يفتح الدرج (بلا inert)",
);
ok(trigger()?.getAttribute("aria-expanded") === "true", "زر الفتح يعكس الحالة المفتوحة");
ok(backdrop() !== null, "الحاجب يظهر مع فتح الدرج");

await act(async () => backdrop().click());
ok(isInert(aside) && backdrop() === null, "النقر على الحاجب يغلق الدرج");

await openDrawer();
await pressEscape();
ok(isInert(aside), "مفتاح Esc يغلق الدرج");

await openDrawer();
await act(async () => sidebar.container.querySelector('a[data-to="/students"]').click());
ok(isInert(aside), "اختيار صفحة من القائمة يغلق الدرج فوراً");

await openDrawer();
await act(async () => closeButton().click());
ok(isInert(aside) && closeButton() !== null, "زر الإغلاق داخل القائمة يغلق الدرج");

await openDrawer();
globalThis.__MARKZ_TEST_PATHNAME__ = "/monthly";
await sidebar.render();
ok(isInert(aside), "تغيّر المسار (تنقّل من أي مكان) يغلق الدرج تلقائياً");

await openDrawer();
await act(async () => setViewport(true));
ok(isInert(aside) === false, "التثبيت (1280px وأعلى) أثناء الفتح يُلغي التعطيل");
ok(trigger() === null, "الزر العائم يختفي عند التثبيت (لا داعي له)");
ok(hasClass(aside, "translate-x-0"), "القائمة مثبّتة وظاهرة عند 1280px وأعلى");

await act(async () => setViewport(false));
ok(isInert(aside) && trigger() !== null, "النزول تحت 1280px يعيد الدرج وزر الفتح");
await sidebar.unmount();

// ---------- حجز المساحة في التخطيط ----------
await act(async () => setViewport(true));
const layout = await mount(AuthenticatedLayout);
const main = layout.container.querySelector("main");
ok(hasClass(main, "mr-72"), "عند التثبيت يُحجز عرض القائمة (mr-72)");

await act(async () => setViewport(false));
await layout.render();
ok(!hasClass(main, "mr-72"), "وتحت 1280px لا تُحجز مساحة (الدرج فوق المحتوى)");
await layout.unmount();

// ============================================================
// النتيجة
// ============================================================
console.log(
  failed === 0
    ? `\nاختبار التخطيط: نجحت ${passed}/${passed} اختبارات ✓`
    : `\nاختبار التخطيط: ${failed} فشل و${passed} نجاح ✗`,
);
process.exit(failed === 0 ? 0 : 1);
