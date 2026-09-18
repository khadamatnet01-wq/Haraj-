// -*- coding: utf-8 -*-
// أكتور Apify مخصّص لاستخراج إعلانات حراج (haraj.com.sa).

import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';

await Actor.init();

const input = (await Actor.getInput()) || {};
const {
    search = '',
    city = '',
    maxResults = 20,
    onlyWithImage = false,
    proxyConfiguration: proxyInput,
    webhookUrl = '',
} = input;

if (!search || !search.trim()) {
    throw new Error('حقل search مطلوب (نص البحث).');
}

const proxyConfiguration = await Actor.createProxyConfiguration(
    proxyInput || { useApifyProxy: true, groups: ['RESIDENTIAL'] },
);

const finalItems = [];

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxConcurrency: 3, // فتح 3 إعلانات معاً لتسريع السحب
    maxRequestsPerCrawl: maxResults + 20,
    requestHandlerTimeoutSecs: 60,
    navigationTimeoutSecs: 60,
    async requestHandler({ page, request, log: reqLog }) {
        
        // 1. حظر الموارد الثقيلة لتوفير استهلاك البروكسي
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
                route.abort();
            } else {
                route.continue();
            }
        });

        // ==========================================
        // مسار 1: استخراج تفاصيل الإعلان من الداخل
        // ==========================================
        if (request.userData.label === 'DETAIL') {
            reqLog.info(`استخراج تفاصيل الإعلان: ${request.url}`);
            await page.goto(request.url, { waitUntil: 'domcontentloaded' });
            
            // جلب البيانات المخفية (أدق وأسرع لجلب الجوال)
            const nextDataText = await page.evaluate(() => {
                const script = document.querySelector('#__NEXT_DATA__');
                return script ? script.innerText : null;
            });

            let item = {
                name: '', phone: '', priceSar: '', city: city || '',
                description: '', has_image: false, images: [],
                url: request.url, maps_url: request.url,
                niche: search, source: 'haraj',
                _raw_id: request.url.match(/\/(\d+)\//)?.[1] || '',
            };

            if (nextDataText) {
                try {
                    const data = JSON.parse(nextDataText);
                    let postObj = null;
                    JSON.stringify(data, (key, value) => {
                        if (value && typeof value === 'object' && value.contactMobile) {
                            postObj = value;
                        }
                        return value;
                    });

                    if (postObj) {
                        item.name = postObj.title || postObj.postTitle || '';
                        item.phone = postObj.contactMobile || '';
                        item.priceSar = postObj.price || postObj.priceSAR || '';
                        item.description = postObj.body || postObj.description || '';
                        item.city = postObj.city || postObj.geoCity || item.city;
                        let imgs = postObj.images || postObj.photos || [];
                        item.images = Array.isArray(imgs) ? imgs : [];
                        item.has_image = item.images.length > 0;
                    }
                } catch (e) {
                    reqLog.warning('فشل تحليل بيانات Next.js، سيتم الاعتماد على النص.');
                }
            }
            
            // استخراج بديل (Fallback) في حال عدم توفر البيانات المخفية
            if (!item.phone || !item.description) {
                try {
                    const btn = await page.$('button:has-text("إظهار"), button:has-text("رقم")');
                    if (btn) await btn.click();
                    await page.waitForTimeout(500);
                } catch(e) {}

                item.name = item.name || await page.evaluate(() => document.querySelector('h1')?.innerText.trim() || '');
                const bodyText = await page.evaluate(() => document.body.innerText);
                item.description = item.description || await page.evaluate(() => document.querySelector('article')?.innerText.trim() || bodyText.substring(0, 500));
                
                // تنظيف النص من المسافات للبحث عن الجوال بذكاء أعلى
                const cleanText = item.description.replace(/[\s\-\_]/g, '');
                const phoneMatch = cleanText.match(/(?:05|5|9665)\d{8}/);
                if (phoneMatch && !item.phone) {
                    item.phone = phoneMatch[0].startsWith('5') ? '0' + phoneMatch[0] : phoneMatch[0];
                }

                // استخراج السعر من النص إذا كان الحقل فارغاً
                if (!item.priceSar) {
                    const priceMatch = item.description.match(/(\d{3,6})\s*(ريال|شهري|سنوي|الف|ألف)/);
                    if (priceMatch) item.priceSar = priceMatch[1];
                }
            }
            
            if (onlyWithImage && !item.has_image) return;

            finalItems.push(item);
            await Actor.pushData(item);
            reqLog.info(`✅ تم التقاط الإعلان | الجوال: ${item.phone || 'غير متوفر'} | السعر: ${item.priceSar || 'غير متوفر'}`);

        // ==========================================
        // مسار 2: صفحة البحث وجمع الروابط
        // ==========================================
        } else {
            reqLog.info(`البحث عن: ${search}`);
            await page.goto(`https://haraj.com.sa/search/${encodeURIComponent(search)}`, { waitUntil: 'domcontentloaded' });

            let collectedUrls = new Set();
            let attempts = 0;

            while (collectedUrls.size < maxResults && attempts < 10) {
                await page.mouse.wheel(0, 3000);
                await page.waitForTimeout(1500);
                
                const urls = await page.$$eval('a[href]', (anchors) => {
                    return anchors.map(a => a.href).filter(href => href.match(/haraj\.com\.sa\/\d+\//));
                });
                
                urls.forEach(u => collectedUrls.add(u));
                attempts++;
            }

            const urlsArray = Array.from(collectedUrls).slice(0, maxResults);
            reqLog.info(`🔍 تم العثور على ${urlsArray.length} رابط، جاري الدخول إليها لجمع الأرقام والأسعار...`);
            
            for (const url of urlsArray) {
                await crawler.addRequests([{ url, userData: { label: 'DETAIL' } }]);
            }
        }
    },
    async failedRequestHandler({ request }, error) {
        log.error(`❌ فشل الطلب ${request.url}: ${error.message}`);
    },
});

await crawler.run([{ url: 'https://haraj.com.sa/', userData: { label: 'SEARCH' } }]);

log.info(`🎉 اكتمل السحب! تم تصدير ${finalItems.length} إعلان بكامل تفاصيلها.`);

// ── إرسال الـ Webhook ─────────────────────────────────────
if (webhookUrl && webhookUrl.trim() !== '') {
    const defaultDatasetId = process.env.APIFY_DEFAULT_DATASET_ID;
    const downloadUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?format=json`;

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'success',
                searchQuery: search,
                itemsCount: finalItems.length,
                downloadUrl: downloadUrl
            })
        });
        log.info('✅ تم إرسال الـ Webhook بنجاح.');
    } catch (err) {
        log.error(`❌ فشل الاتصال بالـ Webhook: ${err.message}`);
    }
}



await Actor.exit();
