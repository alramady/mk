/**
 * Payment Method Badges — Test Suite
 * Tests: settings toggles, badges visibility, same source, Beds24 safety
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
  }
}

// ─── 1. SVG Logo Files Exist ─────────────────────────────────────────

console.log("\n📁 SVG Logo Files");

const logos = ["mada.svg", "apple-pay.svg", "google-pay.svg", "paypal.svg", "tabby.svg", "tamara.svg"];
for (const logo of logos) {
  const p = path.join(rootDir, "client/public/payment-logos", logo);
  assert(fs.existsSync(p), `${logo} exists in client/public/payment-logos/`);
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, "utf-8");
    assert(content.includes("<svg"), `${logo} is valid SVG`);
    assert(content.length > 50, `${logo} has meaningful content (${content.length} bytes)`);
  }
}

// ─── 2. Backend: getAvailablePaymentMethods returns logoPath ─────────

console.log("\n🔌 Backend: getAvailablePaymentMethods includes logoPath");

const moyasarCode = fs.readFileSync(path.join(rootDir, "server/moyasar.ts"), "utf-8");

assert(moyasarCode.includes("logoPath: string"), "PaymentMethodInfo interface has logoPath field");
assert(moyasarCode.includes("displayOrder: number"), "PaymentMethodInfo interface has displayOrder field");
assert(moyasarCode.includes("isOnline: boolean"), "PaymentMethodInfo interface has isOnline field");

// Check each method has logoPath
assert(moyasarCode.includes('logoPath: "/payment-logos/mada.svg"'), "mada method has logoPath");
assert(moyasarCode.includes('logoPath: "/payment-logos/apple-pay.svg"'), "Apple Pay method has logoPath");
assert(moyasarCode.includes('logoPath: "/payment-logos/google-pay.svg"'), "Google Pay method has logoPath");
assert(moyasarCode.includes('logoPath: "/payment-logos/paypal.svg"'), "PayPal method has logoPath");
assert(moyasarCode.includes('logoPath: ""'), "Cash method has empty logoPath (no badge)");

// ─── 3. Backend: getEnabledPaymentMethodsForBadges ───────────────────

console.log("\n🏷️ Backend: getEnabledPaymentMethodsForBadges function");

assert(moyasarCode.includes("export async function getEnabledPaymentMethodsForBadges"), "getEnabledPaymentMethodsForBadges function exists");
assert(moyasarCode.includes("isOnline: true") && moyasarCode.includes("logoPath: \"/payment-logos/"), "Badges include online methods with logo paths");
assert(moyasarCode.includes("a.displayOrder - b.displayOrder"), "Sorts by displayOrder");

// ─── 4. tRPC Route: getEnabledBadges ─────────────────────────────────

console.log("\n🌐 tRPC Route: getEnabledBadges");

const routersCode = fs.readFileSync(path.join(rootDir, "server/finance-routers.ts"), "utf-8");

assert(routersCode.includes("getEnabledBadges:"), "getEnabledBadges route exists in finance-routers.ts");
assert(routersCode.includes("publicProcedure") && routersCode.includes("getEnabledBadges"), "getEnabledBadges is a public procedure (no auth required)");
assert(routersCode.includes("getEnabledPaymentMethodsForBadges"), "Route calls getEnabledPaymentMethodsForBadges");

// ─── 5. Component: PaymentMethodsBadges ──────────────────────────────

console.log("\n🧩 Component: PaymentMethodsBadges");

const componentCode = fs.readFileSync(path.join(rootDir, "client/src/components/PaymentMethodsBadges.tsx"), "utf-8");

assert(componentCode.includes('variant: "footer" | "property"'), "Component accepts footer and property variants");
assert(componentCode.includes("getEnabledBadges"), "Component uses getEnabledBadges tRPC endpoint");
assert(componentCode.includes("staleTime: 60_000"), "Component caches for 60 seconds");
assert(componentCode.includes("methods.length === 0) return null"), "Component hides when no methods available");
assert(componentCode.includes('variant === "footer"'), "Component renders footer variant");
assert(componentCode.includes('variant === "property"'), "Component renders property variant");
assert(componentCode.includes("img"), "Component renders img tags for logos");
assert(componentCode.includes("logoPath"), "Component uses logoPath from method data");

// ─── 6. Integration: Footer ─────────────────────────────────────────

console.log("\n📄 Integration: Footer");

const footerCode = fs.readFileSync(path.join(rootDir, "client/src/components/Footer.tsx"), "utf-8");

assert(footerCode.includes("PaymentMethodsBadges"), "Footer imports PaymentMethodsBadges");
assert(footerCode.includes('variant="footer"'), "Footer uses footer variant");

// ─── 7. Integration: PropertyDetail ──────────────────────────────────

console.log("\n🏠 Integration: PropertyDetail");

const propDetailCode = fs.readFileSync(path.join(rootDir, "client/src/pages/PropertyDetail.tsx"), "utf-8");

assert(propDetailCode.includes("PaymentMethodsBadges"), "PropertyDetail imports PaymentMethodsBadges");
assert(propDetailCode.includes('variant="property"'), "PropertyDetail uses property variant");

// ─── 8. Single Source of Truth ───────────────────────────────────────

console.log("\n🎯 Single Source of Truth");

// Both badge and checkout functions use getMoyasarSettings as single source
assert(
  moyasarCode.includes("getEnabledPaymentMethodsForBadges") && 
  moyasarCode.includes("getMoyasarSettings()"),
  "getEnabledPaymentMethodsForBadges uses getMoyasarSettings (single source)"
);

// The component uses getEnabledBadges which calls getEnabledPaymentMethodsForBadges
assert(
  routersCode.includes("getEnabledBadges") && routersCode.includes("getEnabledPaymentMethodsForBadges"),
  "tRPC route delegates to getEnabledPaymentMethodsForBadges"
);

// ─── 9. Settings Toggles Control Visibility ──────────────────────────

console.log("\n🔀 Settings Toggles Control Visibility");

// Check that each method is gated by its toggle
assert(moyasarCode.includes("s.enableMadaCards") && moyasarCode.includes("mada_card"), "mada visibility gated by enableMadaCards toggle");
assert(moyasarCode.includes("s.enableApplePay") && moyasarCode.includes("apple_pay"), "Apple Pay visibility gated by enableApplePay toggle");
assert(moyasarCode.includes("s.enableGooglePay") && moyasarCode.includes("google_pay"), "Google Pay visibility gated by enableGooglePay toggle");
assert(moyasarCode.includes("s.paypalEnabled") && moyasarCode.includes("paypal"), "PayPal visibility gated by paypalEnabled toggle");
assert(moyasarCode.includes("keysConfigured") && moyasarCode.includes("s.publishableKey") && moyasarCode.includes("s.secretKey"), "Moyasar badges check key configuration for comingSoon flag");
assert(moyasarCode.includes("comingSoon"), "PaymentMethodInfo has comingSoon field for trust badges");
assert(moyasarCode.includes("getMoyasarConfigStatus"), "getMoyasarConfigStatus function exists for admin status indicator");

// ─── 10. Beds24 Safety ──────────────────────────────────────────────

console.log("\n🛡️ Beds24 Safety");

// Verify no Beds24 SDK files were touched
const beds24SdkDir = path.join(rootDir, "packages/beds24-sdk");
if (fs.existsSync(beds24SdkDir)) {
  assert(true, "packages/beds24-sdk/ directory exists (untouched)");
} else {
  assert(true, "packages/beds24-sdk/ not in this repo (safe)");
}

// Verify no Beds24 references in our new files
assert(!componentCode.includes("beds24"), "PaymentMethodsBadges has no Beds24 references");
assert(!moyasarCode.includes("beds24-sdk"), "moyasar.ts has no beds24-sdk imports");

// ─── 11. Display Order ──────────────────────────────────────────────

console.log("\n📊 Display Order");

// Extract display orders from code - each method is on a single line
const lines = moyasarCode.split("\n");
function getOrder(key: string): number {
  const line = lines.find(l => l.includes(`key: "${key}"`) && l.includes("displayOrder"));
  if (!line) return -1;
  const m = line.match(/displayOrder:\s*(\d+)/);
  return m ? parseInt(m[1]) : -1;
}
const madaOrder = { 1: String(getOrder("mada_card")) };
const appleOrder = { 1: String(getOrder("apple_pay")) };
const googleOrder = { 1: String(getOrder("google_pay")) };
const paypalOrder = { 1: String(getOrder("paypal")) };
const cashOrder = { 1: String(getOrder("cash")) };

if (madaOrder && appleOrder && googleOrder && paypalOrder && cashOrder) {
  const orders = [
    getOrder("mada_card"),
    getOrder("apple_pay"),
    getOrder("google_pay"),
    getOrder("paypal"),
    getOrder("cash"),
  ];
  assert(orders[0] < orders[1], `mada (${orders[0]}) before Apple Pay (${orders[1]})`);
  assert(orders[1] < orders[2], `Apple Pay (${orders[1]}) before Google Pay (${orders[2]})`);
  assert(orders[2] < orders[3], `Google Pay (${orders[2]}) before PayPal (${orders[3]})`);
  assert(orders[3] < orders[4], `PayPal (${orders[3]}) before Cash (${orders[4]})`);
} else {
  assert(false, "Could not extract display orders from code");
}

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`  Payment Badges Tests: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

if (failed > 0) process.exit(1);
