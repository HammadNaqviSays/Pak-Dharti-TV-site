export const DICT = {
  en: {
    mostRead: "Most read", site: "Pak Dharti TV", tagline: "Every heart's voice", home: "Home",
    breaking: "Breaking", latest: "Latest news", topStories: "Top stories", more: "More",
    sources: "Sources", photo: "Photo", empty: "No stories published yet.",
    desk: "Pak Dharti TV Desk", share: "Share", related: "More from this section",
    ai: "This article was prepared with AI assistance and has not yet been reviewed by an editor.",
    pending: null, language: "Language", menu: "Sections", followUs: "Follow us",
    rights: "All rights reserved.", seeAll: "See all",
    types: { news: "News", feature: "Feature", opinion: "Opinion", story: "Story" },
    cats: { world: "World", pakistan: "Pakistan", politics: "Politics", economy: "Economy", disaster: "Disasters",
      sports: "Sports", entertainment: "Entertainment", inspirational: "Inspiring stories", folklore: "Folk tales", religion: "Religion", poetry: "Poetry", quotes: "Words of wisdom", books: "Books" },
  },
  ur: {
    mostRead: "سب سے زیادہ پڑھی گئی", site: "پاک دھرتی ٹی وی", tagline: "ہر دل کی آواز", home: "صفحۂ اول",
    breaking: "بریکنگ نیوز", latest: "تازہ ترین", topStories: "اہم خبریں", more: "مزید",
    sources: "ذرائع", photo: "تصویر", empty: "ابھی کوئی خبر شائع نہیں ہوئی۔",
    desk: "پاک دھرتی ٹی وی ڈیسک", share: "شیئر کریں", related: "اس شعبے کی مزید خبریں",
    ai: "یہ تحریر AI کی مدد سے تیار کی گئی ہے اور ابھی ادارتی جائزے سے نہیں گزری۔",
    pending: "اس مضمون کا اردو ترجمہ جلد آ رہا ہے، فی الحال انگریزی متن دکھایا جا رہا ہے۔",
    language: "زبان", menu: "شعبے", followUs: "ہمیں فالو کریں",
    rights: "جملہ حقوق محفوظ ہیں۔", seeAll: "سب دیکھیں",
    types: { news: "خبر", feature: "فیچر", opinion: "رائے", story: "قصہ" },
    cats: { world: "دنیا", pakistan: "پاکستان", politics: "سیاست", economy: "معیشت", disaster: "آفات",
      sports: "کھیل", entertainment: "تفریح", inspirational: "اچھے واقعات", folklore: "قصے", religion: "مذہب", poetry: "شاعری", quotes: "اقوالِ زریں", books: "کتابیں" },
  },
  ar: {
    mostRead: "الأكثر قراءة", site: "باك دهرتي تي في", tagline: "صوت كل قلب", home: "الرئيسية",
    breaking: "عاجل", latest: "آخر الأخبار", topStories: "أهم الأخبار", more: "المزيد",
    sources: "المصادر", photo: "صورة", empty: "لم تُنشر أي أخبار بعد.",
    desk: "غرفة أخبار باك دهرتي", share: "شارك", related: "المزيد من هذا القسم",
    ai: "أُعدّ هذا المقال بمساعدة الذكاء الاصطناعي ولم تتم مراجعته تحريرياً بعد.",
    pending: "الترجمة العربية قيد الإعداد؛ يُعرض النص الإنجليزي حالياً.",
    language: "اللغة", menu: "الأقسام", followUs: "تابعونا",
    rights: "جميع الحقوق محفوظة.", seeAll: "عرض الكل",
    types: { news: "خبر", feature: "تقرير خاص", opinion: "رأي", story: "حكاية" },
    cats: { world: "العالم", pakistan: "باكستان", politics: "سياسة", economy: "اقتصاد", disaster: "كوارث",
      sports: "رياضة", entertainment: "ترفيه", inspirational: "قصص ملهمة", folklore: "حكايات شعبية", religion: "دين", poetry: "شعر", quotes: "أقوال مأثورة", books: "كتب" },
  },
  de: {
    mostRead: "Meistgelesen", site: "Pak Dharti TV", tagline: "Die Stimme jedes Herzens", home: "Startseite",
    breaking: "Eilmeldung", latest: "Neueste Meldungen", topStories: "Top-Themen", more: "Mehr",
    sources: "Quellen", photo: "Foto", empty: "Noch keine Artikel veröffentlicht.",
    desk: "Pak Dharti TV Redaktion", share: "Teilen", related: "Mehr aus diesem Ressort",
    ai: "Dieser Artikel wurde mit KI-Unterstützung erstellt und noch nicht redaktionell geprüft.",
    pending: "Die deutsche Übersetzung folgt; vorerst wird der englische Text angezeigt.",
    language: "Sprache", menu: "Ressorts", followUs: "Folgen Sie uns",
    rights: "Alle Rechte vorbehalten.", seeAll: "Alle anzeigen",
    types: { news: "Nachricht", feature: "Reportage", opinion: "Meinung", story: "Erzählung" },
    cats: { world: "Welt", pakistan: "Pakistan", politics: "Politik", economy: "Wirtschaft", disaster: "Katastrophen",
      sports: "Sport", entertainment: "Unterhaltung", inspirational: "Inspiration", folklore: "Volksgeschichten", religion: "Religion", poetry: "Poesie", quotes: "Weisheiten", books: "Bücher" },
  },
};

// Order of sections in the navigation bar and on the homepage
export const NAV_CATEGORIES = ["pakistan", "world", "politics", "economy", "sports", "religion", "poetry", "quotes", "books",
  "inspirational", "folklore", "entertainment", "disaster"];

export const LANG_NAMES = { en: "English", ur: "اردو", ar: "العربية", de: "Deutsch" };
export const LOCALES = { en: "en-GB", ur: "ur-PK", ar: "ar", de: "de-DE" };
export const isRTL = (l) => l === "ur" || l === "ar";
