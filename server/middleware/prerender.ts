/**
 * Prerender Middleware for SEO
 * 
 * Detects search engine crawlers and injects pre-rendered HTML content
 * into the SPA shell so that crawlers see meaningful content.
 * 
 * Strategy: Server-side HTML injection (not full SSR)
 * - For bot requests to /, /search, /property/:id
 * - Fetches data from DB directly
 * - Injects semantic HTML into <div id="root">
 * - Preserves client-side hydration (React will take over)
 */
import type { Request, Response, NextFunction } from "express";
import { getDb } from "../db";
import { properties, cities, districts } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

const BOT_USER_AGENTS = [
  'googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'slurp',
  'baiduspider', 'facebookexternalhit', 'twitterbot', 'linkedinbot',
  'whatsapp', 'telegrambot', 'applebot', 'pinterest', 'semrushbot',
  'ahrefsbot', 'mj12bot', 'dotbot', 'petalbot', 'bytespider',
  'curl', 'wget', 'python-requests', 'go-http-client', 'java',
  'lighthouse', 'chrome-lighthouse', 'pagespeed',
];

const BASE_URL = "https://monthlykey.com";

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('ar-SA').format(num);
}

const propertyTypeAr: Record<string, string> = {
  apartment: 'شقة',
  villa: 'فيلا',
  studio: 'استوديو',
  duplex: 'دوبلكس',
  furnished_room: 'غرفة مفروشة',
  compound: 'مجمع سكني',
  hotel_apartment: 'شقة فندقية',
};

async function generateHomeHTML(): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return generateStaticHomeHTML();

    const featuredProps = await db
      .select()
      .from(properties)
      .where(eq(properties.status, 'published'))
      .orderBy(desc(properties.createdAt))
      .limit(12);

    const allCities = await db.select().from(cities).limit(20);

    let html = `
    <div id="prerender-content" style="font-family:'Cairo','Tajawal',sans-serif;direction:rtl;text-align:right;">
      <header style="background:#0A1628;color:#fff;padding:20px;">
        <h1 style="font-size:2rem;margin:0;">المفتاح الشهري - منصة التأجير الشهري في السعودية</h1>
        <p style="color:#aaa;margin-top:8px;">خبير الإيجار الشهري الآن في المملكة العربية السعودية | إدارة إيجارات شهرية متميزة</p>
      </header>
      
      <nav style="padding:10px 20px;background:#0d1f3c;">
        <a href="/" style="color:#3ECFC0;margin-left:20px;">الرئيسية</a>
        <a href="/search" style="color:#fff;margin-left:20px;">البحث</a>
        <a href="/map" style="color:#fff;margin-left:20px;">الخريطة</a>
        <a href="/faq" style="color:#fff;margin-left:20px;">الأسئلة الشائعة</a>
        <a href="/contact" style="color:#fff;margin-left:20px;">اتصل بنا</a>
      </nav>

      <main style="padding:20px;max-width:1200px;margin:0 auto;">
        <section>
          <h2 style="font-size:1.5rem;color:#0A1628;">خدماتنا</h2>
          <p>نقدم مجموعة متكاملة من الخدمات لتسهيل تجربة التأجير الشهري في المملكة العربية السعودية</p>
          <ul>
            <li><strong>إدارة العقارات</strong> - إدارة شاملة لعقارك الشهري مع تقارير دورية</li>
            <li><strong>الإيجار الشهري</strong> - تأجير مرن بعقود رقمية متوافقة</li>
            <li><strong>إدارة الإيرادات</strong> - تسعير ذكي وتحسين العوائد بناءً على السوق</li>
            <li><strong>العناية بالعقار</strong> - صيانة وتجديد وتصميم داخلي احترافي</li>
            <li><strong>تجربة المستأجر</strong> - دعم المستأجرين على مدار الساعة بالعربية</li>
            <li><strong>التحقق والأمان</strong> - تحقق من الهوية الوطنية وعقود رقمية آمنة</li>
          </ul>
        </section>

        <section>
          <h2 style="font-size:1.5rem;color:#0A1628;">كيف يعمل</h2>
          <ol>
            <li><strong>ابحث عن عقارك</strong> - تصفح مئات العقارات المتاحة للتأجير الشهري في مدينتك</li>
            <li><strong>احجز إقامتك</strong> - اختر المدة المناسبة واحجز بسهولة مع عقد رقمي</li>
            <li><strong>استمتع بسكنك</strong> - انتقل واستمتع بإقامة مريحة مع دعم متواصل</li>
          </ol>
        </section>

        <section>
          <h2 style="font-size:1.5rem;color:#0A1628;">عقارات مميزة للإيجار الشهري</h2>
          <p>اكتشف أفضل العقارات المتاحة للتأجير الشهري في السعودية</p>`;

    if (featuredProps.length > 0) {
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;margin-top:20px;">`;
      for (const prop of featuredProps) {
        const typeAr = propertyTypeAr[prop.propertyType] || prop.propertyType;
        html += `
          <article style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#fff;">
            <a href="/property/${prop.id}" style="text-decoration:none;color:inherit;">
              <h3 style="font-size:1.1rem;color:#0A1628;margin:0 0 8px;">${escapeHtml(prop.titleAr)}</h3>
              <p style="color:#666;font-size:0.9rem;margin:4px 0;">${escapeHtml(typeAr)} - ${escapeHtml(prop.cityAr || '')}${prop.districtAr ? '، ' + escapeHtml(prop.districtAr) : ''}</p>
              <p style="color:#3ECFC0;font-weight:bold;font-size:1.2rem;margin:8px 0;">${formatPrice(prop.monthlyRent)} ر.س/شهر</p>
              <div style="display:flex;gap:16px;color:#888;font-size:0.85rem;">
                ${prop.bedrooms ? `<span>${prop.bedrooms} غرف نوم</span>` : ''}
                ${prop.bathrooms ? `<span>${prop.bathrooms} حمامات</span>` : ''}
                ${prop.sizeSqm ? `<span>${prop.sizeSqm} م²</span>` : ''}
              </div>
              ${prop.descriptionAr ? `<p style="color:#555;font-size:0.85rem;margin-top:8px;max-height:60px;overflow:hidden;">${escapeHtml(prop.descriptionAr.substring(0, 200))}</p>` : ''}
            </a>
          </article>`;
      }
      html += `</div>`;
    }

    html += `</section>`;

    if (allCities.length > 0) {
      html += `
        <section style="margin-top:40px;">
          <h2 style="font-size:1.5rem;color:#0A1628;">مدننا</h2>
          <p>اكتشف العقارات المتاحة في أبرز المدن السعودية</p>
          <ul>`;
      for (const city of allCities) {
        html += `<li><a href="/search?city=${city.id}">${escapeHtml(city.nameAr || city.nameEn)}</a> - ${escapeHtml(city.region || '')}</li>`;
      }
      html += `</ul></section>`;
    }

    html += `
        <section style="margin-top:40px;">
          <h2 style="font-size:1.5rem;color:#0A1628;">آراء عملائنا</h2>
          <blockquote style="border-right:3px solid #C5A55A;padding-right:16px;margin:16px 0;">
            <p>"منصة المفتاح الشهري سهّلت علي البحث عن شقة شهرية في الرياض. الخدمة ممتازة والعقود واضحة."</p>
            <cite>- أحمد المطيري، مستأجر - الرياض</cite>
          </blockquote>
          <blockquote style="border-right:3px solid #C5A55A;padding-right:16px;margin:16px 0;">
            <p>"سعيدة جداً باختياري لمنصة المفتاح الشهري. من البحث وحتى التوقيع، كل شيء كان سلس واحترافي."</p>
            <cite>- سارة الحربي، مستأجرة - جدة</cite>
          </blockquote>
        </section>

        <section style="margin-top:40px;">
          <h2 style="font-size:1.5rem;color:#0A1628;">حقق أقصى استفادة من عقارك</h2>
          <p>احصل على تقييم إيجار مجاني واكتشف كم يمكن أن يحقق عقارك</p>
          <a href="/list-property" style="display:inline-block;background:#3ECFC0;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">أدرج عقارك مجاناً</a>
          <a href="/search" style="display:inline-block;border:1px solid #3ECFC0;color:#3ECFC0;padding:12px 24px;border-radius:8px;text-decoration:none;margin:8px 16px;">تصفح العقارات</a>
        </section>
      </main>

      <footer style="background:#0A1628;color:#aaa;padding:30px 20px;margin-top:40px;">
        <div style="max-width:1200px;margin:0 auto;">
          <p style="color:#fff;font-size:1.1rem;">المفتاح الشهري</p>
          <p>المنصة الرائدة للإيجار الشهري في المملكة العربية السعودية. نقدم حلول إيجار مرنة لتسهيل تجربة السكن الشهري.</p>
          <nav style="margin-top:16px;">
            <a href="/" style="color:#3ECFC0;margin-left:16px;">الرئيسية</a>
            <a href="/search" style="color:#aaa;margin-left:16px;">البحث</a>
            <a href="/faq" style="color:#aaa;margin-left:16px;">الأسئلة الشائعة</a>
            <a href="/privacy" style="color:#aaa;margin-left:16px;">سياسة الخصوصية</a>
            <a href="/terms" style="color:#aaa;margin-left:16px;">الشروط والأحكام</a>
            <a href="/contact" style="color:#aaa;margin-left:16px;">اتصل بنا</a>
          </nav>
          <p style="margin-top:16px;font-size:0.85rem;">© ${new Date().getFullYear()} المفتاح الشهري Monthly Key. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>`;

    return html;
  } catch (err) {
    console.error('[Prerender] Error generating home HTML:', err);
    return generateStaticHomeHTML();
  }
}

function generateStaticHomeHTML(): string {
  return `
    <div id="prerender-content" style="font-family:'Cairo','Tajawal',sans-serif;direction:rtl;text-align:right;">
      <h1>المفتاح الشهري - منصة التأجير الشهري في السعودية</h1>
      <p>خبير الإيجار الشهري الآن في المملكة العربية السعودية</p>
      <p>إدارة إيجارات شهرية متميزة | الرياض • جدة • المدينة المنورة</p>
      <h2>خدماتنا</h2>
      <ul>
        <li>إدارة العقارات - إدارة شاملة لعقارك الشهري</li>
        <li>الإيجار الشهري - تأجير مرن بعقود رقمية</li>
        <li>إدارة الإيرادات - تسعير ذكي وتحسين العوائد</li>
        <li>العناية بالعقار - صيانة وتجديد احترافي</li>
      </ul>
      <h2>كيف يعمل</h2>
      <ol>
        <li>ابحث عن عقارك</li>
        <li>احجز إقامتك</li>
        <li>استمتع بسكنك</li>
      </ol>
      <a href="/search">تصفح العقارات</a>
      <a href="/list-property">أدرج عقارك</a>
    </div>`;
}

async function generateSearchHTML(query: Record<string, string>): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return `<div id="prerender-content"><h1>البحث عن عقارات للإيجار الشهري في السعودية</h1><p>ابحث عن شقق مفروشة، استوديوهات، وفلل للإيجار الشهري</p><a href="/">العودة للرئيسية</a></div>`;

    const cityFilter = query.city ? parseInt(query.city) : undefined;
    const allProps = await db
      .select()
      .from(properties)
      .where(eq(properties.status, 'published'))
      .orderBy(desc(properties.createdAt))
      .limit(20);

    let cityName = 'السعودية';
    if (cityFilter) {
      const cityRow = await db.select().from(cities).where(eq(cities.id, cityFilter)).limit(1);
      if (cityRow[0]) cityName = cityRow[0].nameAr || cityRow[0].nameEn;
    }

    let html = `
    <div id="prerender-content" style="font-family:'Cairo','Tajawal',sans-serif;direction:rtl;text-align:right;">
      <h1>عقارات للإيجار الشهري في ${escapeHtml(cityName)}</h1>
      <p>اكتشف ${allProps.length}+ عقار متاح للإيجار الشهري. شقق مفروشة، استوديوهات، فلل، ودوبلكس.</p>
      <nav><a href="/">الرئيسية</a> &gt; <a href="/search">البحث</a></nav>`;

    if (allProps.length > 0) {
      html += `<div style="margin-top:20px;">`;
      for (const prop of allProps) {
        const typeAr = propertyTypeAr[prop.propertyType] || prop.propertyType;
        html += `
          <article style="border-bottom:1px solid #eee;padding:16px 0;">
            <a href="/property/${prop.id}">
              <h2 style="font-size:1.1rem;margin:0;">${escapeHtml(prop.titleAr)}</h2>
            </a>
            <p>${escapeHtml(typeAr)} - ${escapeHtml(prop.cityAr || '')}${prop.districtAr ? '، ' + escapeHtml(prop.districtAr) : ''}</p>
            <p style="color:#3ECFC0;font-weight:bold;">${formatPrice(prop.monthlyRent)} ر.س/شهر</p>
            <span>${prop.bedrooms || 0} غرف</span> | <span>${prop.bathrooms || 0} حمامات</span> | <span>${prop.sizeSqm || 0} م²</span>
          </article>`;
      }
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  } catch (err) {
    console.error('[Prerender] Error generating search HTML:', err);
    return `<div id="prerender-content"><h1>البحث عن عقارات للإيجار الشهري</h1></div>`;
  }
}

async function generatePropertyHTML(id: number): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return `<div id="prerender-content"><h1>تفاصيل العقار</h1></div>`;

    const [prop] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
    if (!prop) return `<div id="prerender-content"><h1>العقار غير موجود</h1><a href="/search">تصفح العقارات</a></div>`;

    const typeAr = propertyTypeAr[prop.propertyType] || prop.propertyType;
    const amenities = (prop.amenities as string[] || []);

    const amenityAr: Record<string, string> = {
      wifi: 'واي فاي', parking: 'موقف سيارات', gym: 'نادي رياضي',
      security: 'حراسة أمنية', ac: 'تكييف', water: 'مياه',
      electricity: 'كهرباء', gas: 'غاز', tv: 'تلفزيون',
      laundry: 'غسيل', elevator: 'مصعد', pool: 'مسبح',
      balcony: 'شرفة', furnished: 'مفروش', kitchen: 'مطبخ',
    };

    return `
    <div id="prerender-content" style="font-family:'Cairo','Tajawal',sans-serif;direction:rtl;text-align:right;">
      <nav><a href="/">الرئيسية</a> &gt; <a href="/search">البحث</a> &gt; ${escapeHtml(prop.titleAr)}</nav>
      <article itemscope itemtype="https://schema.org/Accommodation">
        <h1 itemprop="name" style="font-size:1.8rem;">${escapeHtml(prop.titleAr)}</h1>
        <p style="color:#666;">${escapeHtml(typeAr)} في ${escapeHtml(prop.cityAr || '')}${prop.districtAr ? '، ' + escapeHtml(prop.districtAr) : ''}</p>
        
        <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <p style="font-size:1.5rem;color:#3ECFC0;font-weight:bold;">
            <span itemprop="price">${formatPrice(prop.monthlyRent)}</span>
            <span itemprop="priceCurrency" content="SAR"> ر.س/شهر</span>
          </p>
        </div>

        <h2>تفاصيل العقار</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;border-bottom:1px solid #eee;">النوع</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(typeAr)}</td></tr>
          ${prop.bedrooms ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;">غرف النوم</td><td style="padding:8px;border-bottom:1px solid #eee;">${prop.bedrooms}</td></tr>` : ''}
          ${prop.bathrooms ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;">الحمامات</td><td style="padding:8px;border-bottom:1px solid #eee;">${prop.bathrooms}</td></tr>` : ''}
          ${prop.sizeSqm ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;">المساحة</td><td style="padding:8px;border-bottom:1px solid #eee;">${prop.sizeSqm} م²</td></tr>` : ''}
          ${prop.floor ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;">الطابق</td><td style="padding:8px;border-bottom:1px solid #eee;">${prop.floor}</td></tr>` : ''}
        </table>

        ${prop.descriptionAr ? `<h2>الوصف</h2><p itemprop="description">${escapeHtml(prop.descriptionAr)}</p>` : ''}

        ${amenities.length > 0 ? `
          <h2>المرافق والخدمات</h2>
          <ul>${amenities.map(a => `<li>${escapeHtml(amenityAr[a] || a)}</li>`).join('')}</ul>
        ` : ''}

        <div itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">
          <meta itemprop="addressLocality" content="${escapeHtml(prop.city || '')}" />
          <meta itemprop="addressRegion" content="${escapeHtml(prop.cityAr || '')}" />
          <meta itemprop="addressCountry" content="SA" />
        </div>
      </article>
      
      <a href="/search" style="display:inline-block;background:#3ECFC0;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:20px;">تصفح المزيد من العقارات</a>
    </div>`;
  } catch (err) {
    console.error('[Prerender] Error generating property HTML:', err);
    return `<div id="prerender-content"><h1>تفاصيل العقار</h1></div>`;
  }
}

// Cache for prerendered pages (5 minute TTL)
const prerenderCache = new Map<string, { html: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedOrGenerate(key: string, generator: () => Promise<string>): Promise<string> {
  const cached = prerenderCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return Promise.resolve(cached.html);
  }
  return generator().then(html => {
    prerenderCache.set(key, { html, timestamp: Date.now() });
    // Limit cache size
    if (prerenderCache.size > 500) {
      const oldest = Array.from(prerenderCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) prerenderCache.delete(oldest[0]);
    }
    return html;
  });
}

/**
 * Generate dynamic meta tags for specific pages
 */
/**
 * Resolve image URL: proxy external CDN images through our server for reliable OG previews
 */
function resolveImageUrl(imageUrl: string): string {
  if (!imageUrl) return `${BASE_URL}/logo-mark.png`;
  // If it's a relative /uploads/ path, it won't work (Railway ephemeral FS)
  if (imageUrl.startsWith('/uploads/')) return `${BASE_URL}/logo-mark.png`;
  // If it's an external URL, proxy it through our server for reliability
  if (imageUrl.startsWith('http')) {
    return `${BASE_URL}/api/img-proxy?url=${encodeURIComponent(imageUrl)}`;
  }
  return `${BASE_URL}/logo-mark.png`;
}

function generateMetaTags(path: string, data?: any): string {
  const base = BASE_URL;
  
  // ── Homepage meta tags ──
  if (path === '/' || path === '') {
    const title = 'المفتاح الشهري — منصة التأجير الشهري الرائدة في السعودية | Monthly Key';
    const desc = 'اكتشف أفضل الشقق المفروشة، الاستوديوهات، والفلل للإيجار الشهري في الرياض، جدة، الدمام وجميع المدن السعودية. حجز سهل وعقود رقمية آمنة.';
    const ogImage = `${base}/api/og/homepage.png`;
    return `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(desc)}" />
    <link rel="canonical" href="${base}/" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:url" content="${base}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="المفتاح الشهري - Monthly Key" />
    <meta property="og:locale" content="ar_SA" />

    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="المفتاح الشهري - منصة التأجير الشهري في السعودية" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(desc)}" />
    <meta name="twitter:image" content="${ogImage}" />
    <meta name="twitter:image:alt" content="المفتاح الشهري - Monthly Key" />`;
  }

  // ── Property page meta tags ──
  if (path.startsWith('/property/') && data) {
    const prop = data;
    const typeAr = propertyTypeAr[prop.propertyType] || prop.propertyType;
    const location = [prop.cityAr, prop.districtAr].filter(Boolean).join(' — ');
    const title = `${prop.titleAr} — ${location || 'السعودية'} | المفتاح الشهري`;
    
    const highlights: string[] = [];
    if (prop.bedrooms) highlights.push(`${prop.bedrooms} غرف`);
    if (prop.bathrooms) highlights.push(`${prop.bathrooms} حمامات`);
    if (prop.sizeSqm) highlights.push(`${prop.sizeSqm} م²`);
    const highlightStr = highlights.length > 0 ? ` • ${highlights.join(' • ')}` : '';
    const desc = `${typeAr} للإيجار الشهري | من ${formatPrice(prop.monthlyRent)} ر.س/شهر${highlightStr} | ${location || 'السعودية'}`;
    
    const url = `${base}/property/${prop.id}`;
    const ogImage = `${base}/api/og/property/${prop.id}.png`;
    
    // Also keep the original photo as fallback
    const rawPhotos: string[] = Array.isArray(prop.photos) ? prop.photos : (typeof prop.photos === 'string' ? JSON.parse(prop.photos || '[]') : []);
    const validPhoto = rawPhotos.find((p: string) => p && !p.startsWith('/uploads/')) || '';
    const photoUrl = validPhoto ? resolveImageUrl(validPhoto) : '';
    
    return `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(desc)}" />
    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="المفتاح الشهري - Monthly Key" />
    <meta property="og:locale" content="ar_SA" />

    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(prop.titleAr || 'عقار للإيجار الشهري')}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(desc)}" />
    <meta name="twitter:image" content="${ogImage}" />
    <meta name="twitter:image:alt" content="${escapeHtml(prop.titleAr || 'عقار للإيجار الشهري')}" />
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Accommodation",
      "name": "${escapeHtml(prop.titleAr)}",
      "description": "${escapeHtml((prop.descriptionAr || '').substring(0, 300))}",
      "url": "${url}",
      "image": "${escapeHtml(photoUrl || ogImage)}",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "${escapeHtml(prop.cityAr || '')}",
        "addressCountry": "SA"
      },
      "offers": {
        "@type": "Offer",
        "price": "${prop.monthlyRent}",
        "priceCurrency": "SAR",
        "availability": "https://schema.org/InStock"
      },
      "numberOfBedrooms": ${prop.bedrooms || 0},
      "numberOfBathroomsTotal": ${prop.bathrooms || 0},
      "floorSize": {
        "@type": "QuantitativeValue",
        "value": ${prop.sizeSqm || 0},
        "unitCode": "MTK"
      }
    }
    </script>`;
  }

  // ── Search page meta tags ──
  if (path === '/search') {
    const title = 'البحث عن عقارات للإيجار الشهري في السعودية | المفتاح الشهري';
    const desc = 'ابحث عن شقق مفروشة، استوديوهات، فلل، ودوبلكس للإيجار الشهري في الرياض، جدة، الدمام وجميع المدن السعودية.';
    const ogImage = `${base}/api/og/homepage.png`;
    return `
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${base}/search" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${base}/search" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="المفتاح الشهري - Monthly Key" />
    <meta property="og:locale" content="ar_SA" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${ogImage}" />`;
  }

  return ''; // Use default meta from index.html
}

/**
 * Express middleware that intercepts bot requests and injects prerendered HTML
 */
export function prerenderMiddleware(htmlTemplate: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userAgent = req.headers['user-agent'] || '';
    
    // Only intercept for bots
    if (!isBot(userAgent)) {
      return next();
    }

    const path = req.path;
    const query = req.query as Record<string, string>;

    try {
      let prerenderHTML = '';
      let metaTags = '';
      
      // Route matching
      if (path === '/' || path === '') {
        prerenderHTML = await getCachedOrGenerate('home', generateHomeHTML);
        metaTags = generateMetaTags('/');  // Now generates dynamic OG image tags
      } else if (path === '/search') {
        const cacheKey = `search:${JSON.stringify(query)}`;
        prerenderHTML = await getCachedOrGenerate(cacheKey, () => generateSearchHTML(query));
        metaTags = generateMetaTags('/search');
      } else if (path.match(/^\/property\/(\d+)$/)) {
        const id = parseInt(path.split('/')[2]);
        prerenderHTML = await getCachedOrGenerate(`property:${id}`, () => generatePropertyHTML(id));
        // Fetch property data for meta tags
        try {
          const db = await getDb();
          if (db) {
            const [prop] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
            if (prop) metaTags = generateMetaTags(path, prop);
          }
        } catch {}
      } else {
        // Not a prerenderable route, pass through
        return next();
      }

      // Inject prerendered HTML into the template
      let html = htmlTemplate;
      
      // Replace empty root div with prerendered content
      html = html.replace(
        '<div id="root"></div>',
        `<div id="root">${prerenderHTML}</div>`
      );

      // Inject dynamic meta tags: replace static OG/Twitter tags with dynamic ones
      if (metaTags) {
        // Remove existing static OG and Twitter meta tags to prevent duplicates
        html = html.replace(/<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/?>\s*\n?/g, '');
        html = html.replace(/<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/?>\s*\n?/g, '');
        // Remove the static title tag (dynamic one will be injected)
        html = html.replace(/<title>[^<]*<\/title>\s*\n?/, '');
        // Remove static canonical and description to prevent duplicates
        html = html.replace(/<link\s+rel="canonical"[^>]*>\s*\n?/g, '');
        html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>\s*\n?/g, '');
        // Inject dynamic meta tags before </head>
        html = html.replace('</head>', `${metaTags}\n</head>`);
      }

      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(html);
    } catch (err) {
      console.error('[Prerender] Middleware error:', err);
      next(); // Fall through to normal serving
    }
  };
}
