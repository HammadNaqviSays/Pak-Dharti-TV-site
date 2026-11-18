// Site information pages (About, Contact, Privacy, Terms, Editorial policy), in English and Urdu.
// Arabic and German pages fall back to the English text. "{EMAIL}" and "{UPDATED}" are filled in when rendered.

export const PAGE_SLUGS = ["about", "contact", "privacy", "terms", "editorial-policy", "corrections-policy"];
export const UPDATED = "November 7, 2026";

export const PAGE_TITLES = {
  en: { about: "About us", contact: "Contact us", privacy: "Privacy policy", terms: "Terms of use", "editorial-policy": "Editorial policy", "corrections-policy": "Corrections policy" },
  ur: { about: "ہمارے بارے میں", contact: "رابطہ کریں", privacy: "پرائیویسی پالیسی", terms: "شرائطِ استعمال", "editorial-policy": "ادارتی پالیسی", "corrections-policy": "تصحیح کی پالیسی" },
  ar: { about: "من نحن", contact: "اتصل بنا", privacy: "سياسة الخصوصية", terms: "شروط الاستخدام", "editorial-policy": "السياسة التحريرية", "corrections-policy": "سياسة التصحيح" },
  de: { about: "Über uns", contact: "Kontakt", privacy: "Datenschutz", terms: "Nutzungsbedingungen", "editorial-policy": "Redaktionelle Richtlinien", "corrections-policy": "Korrekturrichtlinie" },
};

const EN = {
  about: `
**Pak Dharti TV** is an independent digital news portal that brings news and stories from Pakistan and the world to readers in **English and Urdu**.

## What we publish
- **News** from Pakistan and around the world: politics, economy, religion, disasters and public life
- **Explainers and analysis** that give the background behind the headlines
- **Inspirational stories** about ordinary people doing extraordinary things
- **Culture**: classical Urdu, Punjabi and Saraiki poetry, folk tales, quotes and books

## How we work
Our newsroom uses modern tools, including AI-assisted drafting and translation, to report quickly in English and Urdu. Every story is based on named, credible sources, and stories marked as reviewed by our desk have been checked by an editor. Read our [Editorial policy](/en/editorial-policy) to see exactly how we work, how we use AI and how we correct mistakes.

## Editorial team and ownership
{TEAM_BLOCK}

Any advertising or sponsorship never influences what we report; see our [Editorial policy](/en/editorial-policy).

## How AI is used
We use AI tools to help draft and translate stories from published reports. Every story is checked by an automated fact-check pass against its sources, and stories that an editor has read are marked **Desk**. Stories without that mark say so at the end of the article. AI is never used to invent facts, quotes or images of real events.

## Our promise
- Facts first, attributed to their sources
- News and opinion kept clearly separate
- Respect for every faith, community and region
- Mistakes corrected openly and quickly

## Our official pages
**Pak Dharti TV** (pakdhartitv.com) publishes on these official pages. Please follow the links below to be sure you reach the real Pak Dharti TV:
- Website: [www.pakdhartitv.com](https://www.pakdhartitv.com)
- Facebook: [facebook.com/PakDhartiTV](https://www.facebook.com/PakDhartiTV)
- Instagram: [instagram.com/pakdhartitv](https://www.instagram.com/pakdhartitv/)
- WhatsApp channel: [Pak Dharti TV on WhatsApp](https://whatsapp.com/channel/0029Va8jtx60LKZMvaskC22D)

## Contact
Write to us through our [contact page](/en/contact){EMAIL_LINE}.
`,
  contact: `
We would love to hear from you: news tips, corrections, feedback or business enquiries.

- **Corrections:** if you find a mistake in any story, please send us the link and the correction. We review every request.
- **News tips:** tell us what is happening in your area. Please include how we can verify it.
- **Advertising and partnerships:** use the form below and choose "Business".
{EMAIL_LINE_BLOCK}
Use the form below and our team will reply as soon as possible.
`,
  privacy: `
*Last updated: {UPDATED}*

This policy explains what information Pak Dharti TV ("we", "us") collects when you use this website, and how it is used.

## Information we collect
- **Reading statistics.** We count how many times each story and page is read, per day, together with the language, the referring website or app (for example Facebook or Google), the country, region and city that our hosting provider derives from your connection, and your device type. These counts are anonymous totals: we do not store your name, IP address, cookies or any identifier with them.
- **Contact form.** If you write to us, we store the name, email address and message you send so we can reply. We do not sell or share these details.
- **Location for prayer times.** To show prayer times for your city, our server uses the approximate location (city and coordinates) that our hosting provider derives from your internet connection. If you press "Use my location", your browser shares your device location with the page for that calculation only. We do not store your location.
- **Server logs.** Our hosting provider (Vercel) keeps standard technical logs, such as IP address, browser type and pages requested, for security and reliability.

## Cookies and advertising
- We may display advertisements served by **Google AdSense**. Google and its partners use cookies to serve ads based on your prior visits to this and other websites.
- Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to our site and/or other sites on the internet.
- You may opt out of personalised advertising by visiting [Google Ads Settings](https://adssettings.google.com). You can also opt out of some third-party vendors' use of cookies for personalised advertising at [www.aboutads.info](https://www.aboutads.info/choices).
- Learn more about how Google uses information from sites that use its services: [policies.google.com/technologies/partner-sites](https://policies.google.com/technologies/partner-sites).
- Where the law requires it (for example in the European Economic Area and the UK), you will be asked for consent before personalised ads are shown.

## Third-party content
Photos may come from Wikimedia Commons, Unsplash or official sources and are credited under each image. Links to other websites are provided for reference; we are not responsible for their content or privacy practices.

## Children
This website is intended for a general audience and is not directed at children under 13. We do not knowingly collect personal information from children.

## Your rights
You can ask us to show, correct or delete any personal information you sent us through the contact form. Write to us through the [contact page](/en/contact).

## Changes
We may update this policy. The date at the top shows when it was last changed.
`,
  terms: `
*Last updated: {UPDATED}*

By using Pak Dharti TV you agree to these terms.

## Use of content
- You may read, share links to and quote short parts of our stories with a clear credit and a link to the original story.
- You may not republish whole stories, graphics or videos without written permission.
- Classical poetry on this site is in the public domain. Our calligraphy cards may be shared freely with the Pak Dharti TV mark kept on them.

## Accuracy
We work hard to be accurate, but news changes quickly. Content is provided for information only and is not legal, financial, medical or religious advice. Currency, gold and prayer-time figures are estimates; please confirm with official sources before making decisions.

## Comments and submissions
If you send us tips, photos or messages, you confirm that you have the right to share them and that they are not unlawful, defamatory or hateful.

## Links
We are not responsible for the content of websites we link to.

## Liability
Pak Dharti TV is not liable for any loss arising from the use of this website, to the extent permitted by law.

## Governing law
These terms are governed by the laws of the Islamic Republic of Pakistan.

## Contact
Questions about these terms: [contact page](/en/contact).
`,
  "editorial-policy": `
*Last updated: {UPDATED}*

## Our principles
1. **Accuracy first.** Every claim in a news story is attributed to a named, credible source: an official statement, a court document, a recognised news agency or an on-record person.
2. **Fairness.** When a story is about a dispute, we include the main sides. We do not make personal attacks on anyone.
3. **News and opinion are separate.** Opinion and analysis pieces are clearly labelled. News stories do not take sides.
4. **No hate, no incitement.** We do not publish content that targets any religion, sect, ethnicity or region, or that encourages violence.
5. **Respect for the law.** We follow the laws of Pakistan, including on defamation and court proceedings.

## How we use AI
Pak Dharti TV uses AI tools to help draft stories from published source reports and to translate them between English and Urdu. AI tools never invent facts, quotes or sources: every draft is built from the cited reports and is written in our own words. We quote a source directly only when needed, keep such quotes short and always credit the speaker or outlet. Stories marked as reviewed by our desk have been checked and approved by an editor before publication. Stories without that mark carry a note saying they were prepared with AI assistance.

## Sources and photos
Sources are listed at the end of each story. Photos are our own, licensed from Wikimedia Commons or Unsplash with credit, or official handouts. We do not use other outlets' photos or graphics without permission.

## Corrections
If we get something wrong, we fix it and, for significant errors, add a correction note to the story. Read our full [Corrections policy](/en/corrections-policy) or send a correction through our [contact page](/en/contact).

## Independence
Our editorial decisions are not for sale. Advertising is kept separate from news content, and paid content, if any, will always be labelled.
`,
  "corrections-policy": `
*Last updated: {UPDATED}*

Accuracy matters more to us than speed. When we get something wrong, we say so, fix it and make the fix visible.

## What we correct
- **Errors of fact:** a wrong name, number, date, place, quote or attribution, or a photo or caption that does not match the story.
- **Misleading framing:** a headline or opening that gives a wrong impression of what the sources say.
- **Translation errors:** a meaning that changed between our English and Urdu versions.
- **Out-of-date information:** a story whose key facts have changed since publication.

## How we correct
1. **Fix the story.** We correct the text as soon as we have confirmed the right information from a named, credible source.
2. **Add a visible note.** For a significant error we add a dated line at the top of the story, for example: *"Correction (7 November 2026): an earlier version gave the toll as 12; officials have confirmed 10."* Small typing and spelling slips are fixed without a note.
3. **Update both languages.** The English and Urdu versions are kept in step.
4. **Withdraw if we must.** A story that cannot be supported by credible sources, or that could cause serious harm or breaks the law, is taken down, and we say why where we can.

## How to report a mistake
Use our [contact page](/en/contact){EMAIL_LINE}. Please send the link to the story, what is wrong and, if you can, where we can verify the right information. We aim to review every request within two working days and will tell you what we decided.

## AI-assisted stories
We use AI to help draft and translate stories, and AI can make mistakes. Every story is checked against its sources, and errors found in AI-assisted text are treated and corrected exactly like any other error.

## Right of reply
If a story concerns a person or organisation and you believe it is unfair or incomplete, write to us. We will consider adding your response or a clarification.

See also our [Editorial policy](/en/editorial-policy).
`,
};

const UR = {
  about: `
**پاک دھرتی ٹی وی** ایک آزاد ڈیجیٹل نیوز پورٹل ہے جو پاکستان اور دنیا بھر کی خبریں اور کہانیاں **اردو اور انگریزی** زبانوں میں قارئین تک پہنچاتا ہے۔

## ہم کیا شائع کرتے ہیں
- پاکستان اور دنیا کی **خبریں**: سیاست، معیشت، مذہب، آفات اور عوامی زندگی
- خبروں کے پس منظر پر **تجزیے اور وضاحتیں**
- عام لوگوں کی غیر معمولی کاوشوں پر **حوصلہ افزا کہانیاں**
- **ثقافت**: اردو، پنجابی اور سرائیکی کی کلاسیکی شاعری، لوک کہانیاں، اقوال اور کتابیں

## ہمارا طریقۂ کار
ہمارا نیوز روم اردو اور انگریزی میں تیزی سے خبر دینے کے لیے جدید ٹولز، بشمول مصنوعی ذہانت (AI) کی مدد سے مسودہ نویسی اور ترجمہ، استعمال کرتا ہے۔ ہر خبر مستند اور نامزد ذرائع پر مبنی ہوتی ہے، اور جن خبروں پر ”ڈیسک رپورٹ“ لکھا ہو وہ ایڈیٹر کی جانچ کے بعد شائع ہوتی ہیں۔ تفصیل کے لیے ہماری [ادارتی پالیسی](/ur/editorial-policy) دیکھیں۔

## ادارتی ٹیم اور ملکیت
{TEAM_BLOCK}

اشتہارات یا سپانسرشپ کا ہماری خبروں پر کوئی اثر نہیں ہوتا؛ تفصیل [ادارتی پالیسی](/ur/editorial-policy) میں ہے۔

## مصنوعی ذہانت کا استعمال
ہم شائع شدہ رپورٹس سے خبر کا مسودہ بنانے اور ترجمے کے لیے AI ٹولز استعمال کرتے ہیں۔ ہر خبر کو ذرائع کے مقابل خودکار جانچ سے گزارا جاتا ہے، اور جو خبر ایڈیٹر نے پڑھ لی ہو اس پر **ڈیسک** کا نشان لگتا ہے۔ جس پر یہ نشان نہ ہو اس کے آخر میں اس کا نوٹ درج ہوتا ہے۔ AI سے کوئی حقیقت، بیان یا حقیقی واقعے کی تصویر گھڑنے کا کام نہیں لیا جاتا۔

## ہمارا وعدہ
- سب سے پہلے حقائق، ذرائع کے حوالے کے ساتھ
- خبر اور رائے کو واضح طور پر الگ رکھنا
- ہر مذہب، برادری اور علاقے کا احترام
- غلطی کی کھلے دل سے اور فوری تصحیح

## ہمارے آفیشل صفحات
**پاک دھرتی ٹی وی** (pakdhartitv.com) ان آفیشل صفحات پر شائع ہوتا ہے۔ اصل پاک دھرتی ٹی وی تک پہنچنے کے لیے نیچے کے لنک استعمال کریں:
- ویب سائٹ: [www.pakdhartitv.com](https://www.pakdhartitv.com)
- فیس بک: [facebook.com/PakDhartiTV](https://www.facebook.com/PakDhartiTV)
- انسٹاگرام: [instagram.com/pakdhartitv](https://www.instagram.com/pakdhartitv/)
- واٹس ایپ چینل: [پاک دھرتی ٹی وی واٹس ایپ پر](https://whatsapp.com/channel/0029Va8jtx60LKZMvaskC22D)

## رابطہ
ہم سے [رابطہ صفحے](/ur/contact) کے ذریعے بات کریں{EMAIL_LINE}۔
`,
  contact: `
آپ کی رائے، خبر کی اطلاع، تصحیح یا کاروباری رابطہ — ہمیں آپ سے سن کر خوشی ہوگی۔

- **تصحیح:** اگر کسی خبر میں غلطی نظر آئے تو خبر کا لنک اور درست بات ہمیں بھیجیں۔ ہم ہر درخواست کا جائزہ لیتے ہیں۔
- **خبر کی اطلاع:** اپنے علاقے کی خبر بتائیں، اور یہ بھی کہ ہم اس کی تصدیق کیسے کر سکتے ہیں۔
- **اشتہارات اور شراکت داری:** نیچے دیا گیا فارم استعمال کریں۔
{EMAIL_LINE_BLOCK}
نیچے دیا گیا فارم پُر کریں، ہماری ٹیم جلد جواب دے گی۔
`,
  privacy: `
*آخری تبدیلی: {UPDATED}*

یہ پالیسی بتاتی ہے کہ پاک دھرتی ٹی وی اس ویب سائٹ کے استعمال کے دوران کون سی معلومات جمع کرتا ہے اور انہیں کیسے استعمال کیا جاتا ہے۔

## ہم کون سی معلومات جمع کرتے ہیں
- **مطالعے کے اعداد و شمار:** ہم صرف یہ گنتے ہیں کہ کوئی خبر کس زبان میں کتنی بار پڑھی گئی۔ اس کے ساتھ آپ کا نام، آئی پی ایڈریس یا کوئی شناخت محفوظ نہیں کی جاتی۔
- **رابطہ فارم:** اگر آپ ہمیں لکھیں تو جواب دینے کے لیے آپ کا نام، ای میل اور پیغام محفوظ کیا جاتا ہے۔ یہ معلومات نہ بیچی جاتی ہیں نہ کسی کو دی جاتی ہیں۔
- **نماز کے اوقات کے لیے مقام:** آپ کے شہر کے مطابق نماز کے اوقات دکھانے کے لیے ہمارا سرور آپ کے انٹرنیٹ کنکشن سے اندازاً معلوم ہونے والا شہر استعمال کرتا ہے۔ ”میرا مقام استعمال کریں“ دبانے پر آپ کا براؤزر صرف اسی حساب کے لیے مقام بتاتا ہے۔ ہم آپ کا مقام محفوظ نہیں کرتے۔
- **سرور لاگز:** ہماری ہوسٹنگ کمپنی (Vercel) سیکیورٹی کے لیے عام تکنیکی ریکارڈ رکھتی ہے۔

## کوکیز اور اشتہارات
- اس ویب سائٹ پر **Google AdSense** کے اشتہارات دکھائے جا سکتے ہیں۔ گوگل اور اس کے شراکت دار کوکیز کے ذریعے آپ کے اس اور دیگر ویب سائٹس کے وزٹ کی بنیاد پر اشتہارات دکھاتے ہیں۔
- ذاتی نوعیت کے اشتہارات بند کرنے کے لیے [Google Ads Settings](https://adssettings.google.com) دیکھیں، یا [aboutads.info](https://www.aboutads.info/choices) پر دیگر کمپنیوں کی کوکیز سے انکار کریں۔
- مزید معلومات: [policies.google.com/technologies/partner-sites](https://policies.google.com/technologies/partner-sites)

## دیگر ذرائع کا مواد
تصاویر Wikimedia Commons، Unsplash یا سرکاری ذرائع سے لی جاتی ہیں اور ہر تصویر کے نیچے حوالہ دیا جاتا ہے۔ دوسری ویب سائٹس کے لنکس صرف حوالے کے لیے ہیں۔

## بچے
یہ ویب سائٹ عام قارئین کے لیے ہے؛ ہم 13 سال سے کم عمر بچوں کی معلومات جان بوجھ کر جمع نہیں کرتے۔

## آپ کے حقوق
رابطہ فارم کے ذریعے بھیجی گئی اپنی معلومات دیکھنے، درست کرنے یا حذف کرنے کے لیے [رابطہ صفحے](/ur/contact) پر لکھیں۔
`,
  terms: `
*آخری تبدیلی: {UPDATED}*

پاک دھرتی ٹی وی استعمال کرنے سے آپ ان شرائط سے اتفاق کرتے ہیں۔

## مواد کا استعمال
- آپ ہماری خبریں پڑھ سکتے ہیں، ان کے لنک شیئر کر سکتے ہیں اور واضح حوالے اور لنک کے ساتھ مختصر اقتباس دے سکتے ہیں۔
- تحریری اجازت کے بغیر مکمل خبریں، گرافکس یا ویڈیوز دوبارہ شائع کرنا منع ہے۔
- اس ویب سائٹ پر موجود کلاسیکی شاعری عوامی ملکیت ہے۔ ہمارے خطاطی کارڈ پاک دھرتی ٹی وی کے نشان کے ساتھ آزادانہ شیئر کیے جا سکتے ہیں۔

## درستی
ہم درست معلومات دینے کی پوری کوشش کرتے ہیں، مگر یہ مواد صرف معلومات کے لیے ہے اور قانونی، مالی، طبی یا شرعی مشورہ نہیں۔ کرنسی، سونے کے نرخ اور نماز کے اوقات اندازاً ہیں؛ فیصلہ کرنے سے پہلے سرکاری ذرائع سے تصدیق کریں۔

## قانون
یہ شرائط اسلامی جمہوریہ پاکستان کے قوانین کے تابع ہیں۔
`,
  "editorial-policy": `
*آخری تبدیلی: {UPDATED}*

## ہمارے اصول
1. **سب سے پہلے درستی:** ہر خبر کی ہر بات کسی نامزد اور مستند ذریعے سے منسوب ہوتی ہے: سرکاری بیان، عدالتی دستاویز، معروف خبر رساں ادارہ یا ریکارڈ پر بات کرنے والا شخص۔
2. **انصاف:** کسی تنازعے کی خبر میں تمام اہم فریقین کا مؤقف شامل کیا جاتا ہے۔ ہم کسی پر ذاتی حملہ نہیں کرتے۔
3. **خبر اور رائے الگ:** رائے اور تجزیے پر واضح لیبل ہوتا ہے؛ خبر میں جانبداری نہیں ہوتی۔
4. **نفرت اور اشتعال سے پاک:** ہم کسی مذہب، فرقے، قوم یا علاقے کو نشانہ بنانے یا تشدد پر اکسانے والا مواد شائع نہیں کرتے۔
5. **قانون کا احترام:** ہم پاکستان کے قوانین کی پابندی کرتے ہیں۔

## مصنوعی ذہانت (AI) کا استعمال
ہم شائع شدہ ذرائع سے خبر کا مسودہ تیار کرنے اور اردو و انگریزی میں ترجمے کے لیے AI ٹولز استعمال کرتے ہیں۔ AI کو کوئی حقیقت، بیان یا ذریعہ گھڑنے کی اجازت نہیں؛ ہر مسودہ حوالہ دیے گئے ذرائع پر مبنی اور ہمارے اپنے الفاظ میں ہوتا ہے۔ کسی ذریعے کا اقتباس صرف ضرورت پر، مختصر اور مکمل حوالے کے ساتھ دیا جاتا ہے۔ ”ڈیسک رپورٹ“ والی خبریں ایڈیٹر کی منظوری کے بعد شائع ہوتی ہیں، جبکہ باقی خبروں کے آخر میں AI کی مدد کا نوٹ درج ہوتا ہے۔

## ذرائع اور تصاویر
ہر خبر کے آخر میں ذرائع درج ہوتے ہیں۔ تصاویر ہماری اپنی، Wikimedia Commons یا Unsplash سے حوالے کے ساتھ، یا سرکاری ہینڈ آؤٹ ہوتی ہیں۔ ہم دوسرے اداروں کی تصاویر یا گرافکس اجازت کے بغیر استعمال نہیں کرتے۔

## تصحیح
غلطی ہونے پر ہم اسے درست کرتے ہیں اور اہم غلطی کی صورت میں خبر میں تصحیح کا نوٹ شامل کرتے ہیں۔ مکمل [تصحیح کی پالیسی](/ur/corrections-policy) دیکھیں یا [رابطہ صفحہ](/ur/contact) سے تصحیح بھیجیں۔

## خود مختاری
ہمارے ادارتی فیصلے فروخت کے لیے نہیں۔ اشتہارات خبروں سے الگ رکھے جاتے ہیں، اور اگر کبھی کوئی معاوضہ شدہ مواد ہوا تو اس پر واضح لیبل ہوگا۔
`,
  "corrections-policy": `
*آخری تبدیلی: {UPDATED}*

ہمارے نزدیک درستی رفتار سے زیادہ اہم ہے۔ جب ہم سے غلطی ہو جائے تو ہم اسے مانتے ہیں، درست کرتے ہیں اور درستی کو نظر آنے والا بناتے ہیں۔

## ہم کن غلطیوں کی تصحیح کرتے ہیں
- **حقائق کی غلطی:** غلط نام، عدد، تاریخ، مقام، بیان یا حوالہ، یا ایسی تصویر/کیپشن جو خبر سے مطابقت نہ رکھتی ہو۔
- **گمراہ کن انداز:** ایسی سرخی یا ابتدا جو ذرائع کی بات کا غلط تاثر دے۔
- **ترجمے کی غلطی:** انگریزی اور اردو نسخے کے درمیان مفہوم بدل جانا۔
- **پرانی معلومات:** ایسی خبر جس کے بنیادی حقائق اشاعت کے بعد بدل چکے ہوں۔

## ہم تصحیح کیسے کرتے ہیں
1. **خبر درست کرنا۔** مستند اور نامزد ذریعے سے درست معلومات کی تصدیق ہوتے ہی متن درست کر دیا جاتا ہے۔
2. **نظر آنے والا نوٹ۔** اہم غلطی کی صورت میں خبر کے شروع میں تاریخ کے ساتھ نوٹ لکھا جاتا ہے، مثلاً: *”تصحیح (7 نومبر 2026): پہلے نسخے میں ہلاکتیں 12 لکھی گئی تھیں؛ حکام نے 10 کی تصدیق کی ہے۔“* املا یا ٹائپنگ کی معمولی غلطیاں بغیر نوٹ کے درست کر دی جاتی ہیں۔
3. **دونوں زبانوں میں۔** انگریزی اور اردو نسخے ہم آہنگ رکھے جاتے ہیں۔
4. **ضرورت ہو تو خبر ہٹانا۔** جس خبر کو مستند ذرائع سے ثابت نہ کیا جا سکے، یا جو سنگین نقصان کا سبب بن سکے یا قانون کے خلاف ہو، اسے ہٹا دیا جاتا ہے اور جہاں ممکن ہو وجہ بتائی جاتی ہے۔

## غلطی کی اطلاع کیسے دیں
ہمارا [رابطہ صفحہ](/ur/contact) استعمال کریں{EMAIL_LINE}۔ براہِ کرم خبر کا لنک، غلطی کیا ہے، اور اگر ممکن ہو تو درست معلومات کا ذریعہ بتائیں۔ ہم ہر درخواست کا جائزہ دو کاری دنوں کے اندر لینے کی کوشش کرتے ہیں اور فیصلے سے آگاہ کرتے ہیں۔

## AI کی مدد سے بنی خبریں
ہم مسودے اور ترجمے کے لیے AI استعمال کرتے ہیں، اور AI سے غلطی ہو سکتی ہے۔ ہر خبر کو ذرائع کے مقابل جانچا جاتا ہے، اور AI کی مدد سے بنے متن میں ملنے والی غلطی کی تصحیح بالکل اسی طرح کی جاتی ہے جیسے کسی بھی دوسری غلطی کی۔

## جواب کا حق
اگر کوئی خبر کسی فرد یا ادارے سے متعلق ہے اور آپ کو لگے کہ وہ غیر منصفانہ یا ادھوری ہے تو ہمیں لکھیں۔ ہم آپ کا مؤقف یا وضاحت شامل کرنے پر غور کریں گے۔

مزید دیکھیں: [ادارتی پالیسی](/ur/editorial-policy)۔
`,
};

/** Editorial team block for the About page, built from env vars so nothing is invented:
 *  EDITOR_NAME, EDITOR_TITLE, OWNER_NAME, ORG_ADDRESS (set in Vercel). */
function teamBlock(lang, email) {
  const e = process.env;
  const ur = lang === "ur";
  const rows = [];
  if (e.EDITOR_NAME) rows.push(ur ? `- **${e.EDITOR_TITLE || "ایڈیٹر"}:** ${e.EDITOR_NAME}` : `- **${e.EDITOR_TITLE || "Editor"}:** ${e.EDITOR_NAME}`);
  rows.push(ur ? "- **نیوز ڈیسک:** پاک دھرتی ٹی وی ڈیسک (ادارتی عملہ اور خودکار جانچ کا نظام)" : "- **Newsroom:** Pak Dharti TV Desk (editorial staff and automated fact-check system)");
  if (e.OWNER_NAME) rows.push(ur ? `- **مالک / ناشر:** ${e.OWNER_NAME}` : `- **Owner / publisher:** ${e.OWNER_NAME}`);
  if (e.ORG_ADDRESS) rows.push(ur ? `- **پتہ:** ${e.ORG_ADDRESS}` : `- **Address:** ${e.ORG_ADDRESS}`);
  if (email) rows.push(ur ? `- **ای میل:** ${email}` : `- **Email:** ${email}`);
  rows.push(ur ? "- **تصحیح اور شکایات:** [تصحیح کی پالیسی](/ur/corrections-policy)" : "- **Corrections and complaints:** [Corrections policy](/en/corrections-policy)");
  return rows.join("\n");
}

export function pageText(slug, lang, email) {
  const base = lang === "ur" ? UR : EN;
  const text = base[slug] || "";
  const line = email ? (lang === "ur" ? ` یا ای میل کریں: ${email}` : ` or email us at ${email}`) : "";
  const block = email ? (lang === "ur" ? `- **ای میل:** ${email}\n` : `- **Email:** ${email}\n`) : "";
  return text.replaceAll("{UPDATED}", UPDATED).replaceAll("{TEAM_BLOCK}", teamBlock(lang, email)).replaceAll("{EMAIL_LINE_BLOCK}", block).replaceAll("{EMAIL_LINE}", line).trim();
}
