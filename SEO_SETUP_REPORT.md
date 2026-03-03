# Google Indexing & SEO Setup Report — monthlykey.com

**Commit**: `a3e100c`  
**Build fingerprint**: `index-BAs9CYge.js` (md5: `4ad7b9336fb22989d82888eb065a93f9`)  
**beds24-sdk**: UNTOUCHED (confirmed via `git diff --name-only -- packages/beds24-sdk/`)  
**Repository**: https://github.com/raneemndmo-collab/mk

---

## 1. Robots.txt & Sitemap

### robots.txt — `https://monthlykey.com/robots.txt`

```
User-agent: *
Allow: /
Allow: /search
Allow: /map
Allow: /property/
Allow: /faq
Allow: /privacy
Allow: /terms
Allow: /contact
Allow: /agent/
Allow: /submit-property
Disallow: /admin
Disallow: /admin/
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /api/
Disallow: /tenant
Disallow: /landlord
Disallow: /messages
Disallow: /book/
Disallow: /maintenance/
Disallow: /lease/
Disallow: /pay/
Disallow: /payment/
Disallow: /payment-callback/
Disallow: /edit-property/
Disallow: /list-property
Disallow: /404

Sitemap: https://monthlykey.com/sitemap.xml
```

### sitemap.xml — `https://monthlykey.com/sitemap.xml`

Dynamic server-side generation (`server/middleware/sitemap.ts`):

| Page Type | Source | Priority | changefreq |
|-----------|--------|----------|------------|
| `/` | Static | 1.0 | daily |
| `/search` | Static | 0.9 | daily |
| `/map` | Static | 0.7 | weekly |
| `/submit-property` | Static | 0.6 | monthly |
| `/faq` | Static | 0.5 | monthly |
| `/contact` | Static | 0.5 | monthly |
| `/terms` | Static | 0.3 | monthly |
| `/privacy` | Static | 0.3 | monthly |
| `/property/:id` | DB (active + published) | 0.8 | weekly |
| `/search?city=:id` | DB (all cities) | 0.7 | weekly |

Each URL includes `hreflang` annotations:
```xml
<xhtml:link rel="alternate" hreflang="ar" href="..." />
<xhtml:link rel="alternate" hreflang="en" href="..." />
<xhtml:link rel="alternate" hreflang="x-default" href="..." />
```

**Sitemap auto-updates**: Yes — the sitemap is generated dynamically on each request (cached 1 hour). When new listings are published, they appear in the sitemap automatically.

---

## 2. Indexability Checks

| Page | HTTP Status | noindex? | Auth-gated? | Canonical |
|------|-------------|----------|-------------|-----------|
| `/` | 200 | No | No | `https://monthlykey.com/` |
| `/search` | 200 | No | No | `https://monthlykey.com/search` |
| `/property/:id` | 200 | No | No | `https://monthlykey.com/property/:id` |
| `/map` | 200 | No | No | `https://monthlykey.com/map` |
| `/faq` | 200 | No | No | `https://monthlykey.com/faq` |
| `/privacy` | 200 | No | No | `https://monthlykey.com/privacy` |
| `/terms` | 200 | No | No | `https://monthlykey.com/terms` |
| `/contact` | 200 | No | No | `https://monthlykey.com/contact` |
| `/admin/*` | N/A | Yes | Yes | N/A |
| `/tenant` | N/A | Yes | Yes | N/A |
| `/landlord` | N/A | Yes | Yes | N/A |

**Maintenance mode**: Client-side only. The server-side prerender middleware serves full HTML to bots regardless of maintenance mode state.

---

## 3. SEO Metadata

### Homepage (`/`)

**Title**: `منصة التأجير الشهري في السعودية - المفتاح الشهري` (AR) / `Monthly Rental Platform in Saudi Arabia - Monthly Key` (EN)

**Description**: `اكتشف أفضل الشقق المفروشة، الاستوديوهات، والفلل للإيجار الشهري في الرياض، جدة، الدمام وجميع المدن السعودية. حجز سهل وعقود رقمية آمنة.`

**JSON-LD** (injected client-side + server-side for bots):
- `Organization` schema: name, url, logo, areaServed, contactPoint
- `WebSite` schema: name, alternateName, url, SearchAction potentialAction

### Search Page (`/search`)

**Title**: `البحث عن عقارات للإيجار الشهري - المفتاح الشهري`

**Description**: `ابحث عن شقق مفروشة، استوديوهات، فلل، ودوبلكس للإيجار الشهري في الرياض، جدة، الدمام وجميع المدن السعودية.`

### Property Pages (`/property/:id`)

**Title**: `{property.titleAr} - المفتاح الشهري` (dynamic)

**Description**: `{type} للإيجار الشهري في {city — district} | {price} ر.س/شهر • {beds} غرف • {baths} حمامات • {size} م²`

**JSON-LD**: `RealEstateListing` schema with:
- name, description, url, image
- PostalAddress (locality, region, country: SA)
- Offer (price, priceCurrency: SAR, availability: InStock)
- numberOfBedrooms, numberOfBathroomsTotal, floorSize

### All Pages — Common Tags

| Tag | Value |
|-----|-------|
| `<link rel="canonical">` | `https://monthlykey.com{path}` |
| `<link rel="alternate" hreflang="ar">` | `https://monthlykey.com{path}` |
| `<link rel="alternate" hreflang="en">` | `https://monthlykey.com{path}` |
| `<link rel="alternate" hreflang="x-default">` | `https://monthlykey.com{path}` |
| `<meta name="robots">` | `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` |
| `<meta property="og:type">` | `website` or `article` |
| `<meta property="og:site_name">` | `المفتاح الشهري - Monthly Key` |
| `<meta property="og:locale">` | `ar_SA` or `en_US` |
| `<meta property="og:image">` | Dynamic OG image endpoint |
| `<meta name="twitter:card">` | `summary_large_image` |

---

## 4. Google Search Console — Verification Instructions

### Recommended: DNS TXT Verification (Domain Property)

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Click **"Add property"**
3. Choose **"Domain"** (not URL prefix)
4. Enter: `monthlykey.com`
5. Google will provide a TXT record like:
   ```
   google-site-verification=XXXXXXXXXXXXXXXXX
   ```
6. Add this TXT record to your DNS provider:
   - **Host/Name**: `@` (or leave blank)
   - **Type**: `TXT`
   - **Value**: The verification string from Google
   - **TTL**: 3600 (or default)
7. Wait 5-10 minutes for DNS propagation
8. Click **"Verify"** in Search Console

### After Verification

1. **Submit sitemap**: Go to Sitemaps → Enter `sitemap.xml` → Submit
2. **Request indexing**: Go to URL Inspection → Enter `https://monthlykey.com/` → Click "Request Indexing"
3. **Check coverage**: After 24-48 hours, check the Coverage report for any issues

### Potential DNS/Redirect Issues

- Ensure `www.monthlykey.com` redirects to `monthlykey.com` (or vice versa) — canonical is set to `https://monthlykey.com`
- Ensure HTTPS is enforced (no HTTP access)
- If using Cloudflare or similar CDN, ensure the DNS proxy is enabled

---

## 5. Diff Summary

| File | Lines Changed | Description |
|------|---------------|-------------|
| `client/public/robots.txt` | +5 | Added /map, /submit-property, blocked /forgot-password, /payment-callback, /404 |
| `client/src/components/SEOHead.tsx` | +67/-8 | Fixed BASE_URL, added hreflang, JSON-LD injection, OG image, twitter:card |
| `client/src/pages/Home.tsx` | +35/-1 | Organization + WebSite JSON-LD, bilingual descriptions |
| `client/src/pages/PropertyDetail.tsx` | +54/-2 | Dynamic SEO: property name in title, type+city+price in desc, RealEstateListing JSON-LD |
| `client/src/pages/Search.tsx` | +8/-1 | Enhanced bilingual title/description |
| `server/middleware/sitemap.ts` | +20/-9 | Include published+active properties, added /submit-property, imported `or` from drizzle |

**Total**: +168/-21 lines across 6 files

---

## 6. Checklist

| Check | Status |
|-------|--------|
| Public pages indexable (no noindex) | PASS |
| Private pages blocked/excluded (robots.txt + noindex) | PASS |
| robots.txt accessible with Sitemap directive | PASS |
| sitemap.xml dynamic with published listings | PASS |
| Sitemap auto-updates when new listings publish | PASS |
| Canonical URLs set to https://monthlykey.com/... | PASS |
| hreflang for ar/en/x-default | PASS |
| OG/Twitter meta tags on all public pages | PASS |
| JSON-LD: Organization + WebSite on homepage | PASS |
| JSON-LD: RealEstateListing on property pages | PASS |
| Dynamic title/description on property pages | PASS |
| No changes to packages/beds24-sdk/** | PASS |
| Build succeeds | PASS |
