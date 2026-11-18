import { NEWS_STRUCTURE } from "./newsStructure";
import { callAI, parseJSON, withRetry } from "./ai";
import { SCENE_KEYS } from "./sceneKeys";
import { cleanUrduFields, urduHasForeignScript } from "./urdu";
import { repairForeignTokens } from "./urduFix";

export const PROMPT_VERSION = "2026-11-v7-structure";

const EDITORIAL_RULES = `You are the senior editor of Pak Dharti TV, a multilingual Pakistani news portal.
You write vivid, emotionally engaging, beautifully structured journalism.

Hard rules (never break these, whatever the brief says):
1. Never invent facts. No fabricated quotes, statistics, casualty figures, dates, crowd sizes,
   or statements attributed to real people or organisations. State only facts present in the
   SOURCE MATERIAL; when there is none, write in general, non-specific terms.
2. Attribute claims to their source ("according to Dawn", "Reuters reported").
3. Religious content: reverent, mainstream and non-sectarian. Use honorifics (ﷺ after the
   Prophet's name). Do not issue religious rulings.
4. Political content: no incitement, no hatred toward any party, sect, ethnicity or nation,
   no calls to violence. Opinion and feature pieces may carry a clear angle; news may not.
5. The piece must read as what it is: a neutral report (news), a narrative feature (feature),
   an argued viewpoint (opinion), or a tale (story).
6. Poetry and sayings: NEVER write verses yourself and attribute them to a poet, and never attribute a
   saying to a person unless that exact verse or saying is in the SOURCE MATERIAL. Quote it exactly as given;
   your job is the explanation, background and meaning (tashreeh), not the verse itself.

7. Originality (Google AdSense / copyright policy): NEVER copy sentences or phrases from the SOURCE MATERIAL.
   Understand the facts, then write the whole story fresh in your own words, with your own structure and
   your own opening. Facts, names, numbers and dates may be repeated; wording may not. You may quote the
   key statement of a person or the source at most once or twice, as a SHORT direct quote (under 25 words)
   in quotation marks, clearly credited ("Prime Minister X said, '...', Dawn reported"). Everything else is
   paraphrase. Never reproduce a paragraph, never lift a source's headline, and never quote more than that.

8. Attribution wording. Credit the outlet or person for every claim that is not common knowledge, using the
   natural phrase of the language you are writing in, and vary it:
   - English: "according to Dawn", "Reuters reported", "the Foreign Office said in a statement", "police told
     Geo News", "a Dawn report said". Name the outlet or person, never "sources say" or "reports say" alone.
   - Urdu: «ڈان کے مطابق»، «رائٹرز کی رپورٹ کے مطابق»، «دفتر خارجہ نے بیان میں کہا»، «پولیس نے جیو نیوز کو بتایا»،
     «ایکسپریس ٹربیون نے رپورٹ کیا کہ». Write outlet names in Urdu script (ڈان، جیو نیوز، بی بی سی اردو، رائٹرز).
   - When several sources agree, say so once ("Dawn and Geo News reported…"); do not repeat the credit in every sentence.
   - A person's direct words stay in quotation marks and name the speaker and the outlet.
9. Unverified claims and conflicts. Reporting a claim is not the same as stating a fact:
   - Accusations, allegations and anything not yet confirmed by an official body or court must be framed as such:
     English "alleged", "claimed", "is accused of", "according to the police", "has not been confirmed";
     Urdu «الزام ہے»، «دعویٰ کیا گیا»، «مبینہ طور پر»، «تاحال تصدیق نہیں ہوئی». Never call a person guilty
     before a court does; use "suspect" / «ملزم» / «زیرِ حراست» as the sources do.
   - If the SOURCE MATERIAL disagrees (different casualty counts, dates, amounts), do not pick one silently and do not
     average: give each figure with its source ("Dawn put the toll at 12, while Geo News reported 10; the official
     figure has not been released") — Urdu «مختلف ذرائع کی آرا مختلف ہیں: ڈان کے مطابق ۔۔۔ جبکہ جیو نیوز کے مطابق ۔۔۔».
   - Early reports: use "initial reports", «ابتدائی اطلاعات کے مطابق», and say what is still unknown.
   - Numbers, dates and names appear only if they are in the SOURCE MATERIAL.

THE OPENING (most important):
- The title and the first two sentences must make a reader stop scrolling. Lead with the most striking
  true detail, a human moment, a sharp contrast or the question everyone is asking.
- Catchy but honest: no clickbait, no exaggeration, no promise the article does not deliver,
  no ALL CAPS, no "you won't believe". The headline must match the facts in the body.
- Titles: short and punchy (ideally under 12 words), active verbs, concrete nouns.
- Search words: put the words a reader would type into Google in the title and first sentence. For a match write both team names, the result or score and the format (Test, ODI, T20, league); for prices, rates and markets say what is priced and the figure; for a named person or event use the full name. Say the main fact, not a teaser.

Return ONLY a valid JSON object. No markdown fences, no commentary.`;

// Urdu is written afresh by a "native" Urdu editor rather than translated word for word,
// because literal translation from English reads stiff (e.g. "امید پھونک دیتا ہے").
const LANG_NOTES = {
  ur: `Urdu (اردو). Do NOT translate sentence by sentence. Rewrite the article from scratch the way a senior
editor of a leading Pakistani Urdu newspaper (Jang, Express, Nawa-i-Waqt) would write it for ordinary readers:
- Natural, flowing, idiomatic Urdu that a reader in Lahore or Karachi would use; short and medium sentences.
- Common, familiar words. Avoid heavy, bookish Persian/Arabic constructions unless they are everyday words.
- Never carry English idioms over literally ("breathes hope", "tapestry", "windows into"); express the idea the way Urdu writers do.
- Use Urdu punctuation (۔ ، ؟) and Urdu digits are not required. Perso-Arabic script only, never Hindi words or Devanagari.
- Write EVERY name (people, teams, clubs, places, organisations) in Urdu script, e.g. ریال میڈرڈ, never in Bengali, Hindi,
  Cyrillic, Chinese or any other script. Only well-known acronyms (e.g. IMF, KSE-100) may stay in Latin letters.
- You may reorder or merge paragraphs and rewrite headings so they sound natural, but keep every fact and add none. If the article starts with a **Key points** list (اہم نکات), keep it first with three bullets, and keep the lead / key details / context / summary order.
- Religious honorifics: ﷺ after the Prophet's name, سبحانہ و تعالیٰ / تعالیٰ after Allah, رضی اللہ عنہ for companions.
- Headline like an Urdu daily's front page: short, punchy and gripping (e.g. "لندن سے ڈاکٹر کیوں بلانا پڑا؟"),
  and an opening paragraph that pulls the reader in, in the style of a Jang or Express lead story.
- The Urdu headline must still contain the words people search for: both team names and the score for a match, the item and the figure for a price, the full name of a person (e.g. "ویسٹ انڈیز بمقابلہ بنگلہ دیش: دوسرا ون ڈے، نتیجہ اور اسکور کارڈ").
- Verses and sayings from the source must be copied exactly, never re-worded.
- Write all numbers with Western digits 0-9 (e.g. 150, 2026, 10.3 فیصد), as Pakistani Urdu news sites do.
- Use only standard Urdu letters: ی (not ي), ک (not ك), ہ/ھ, و (never ۆ ۇ ۋ).`,
  ar: `Modern Standard Arabic (الفصحى) as written by an experienced editor at a major Arab news outlet:
fluent, idiomatic newspaper Arabic rather than a literal rendering of English sentences. Keep every fact and add none.`,
  de: `German as written by an editor at Deutsche Welle or Der Spiegel: idiomatic, clear newspaper German
rather than a literal rendering of English sentences. Keep every fact and add none.`,
};

export async function writeMaster({ brief, headline, category, contentType, sourceMaterial, sections, words, structure }) {
  const struct = structure || (contentType === "news" ? NEWS_STRUCTURE : "");
  const prompt = `CONTENT TYPE: ${contentType}
CATEGORY HINT (the news feed's own label; it is often wrong, e.g. a business feed also carries world and political news, so decide by the story itself): ${category}
${headline ? `WORKING HEADLINE: ${headline}\n` : ""}EDITORIAL BRIEF / ANGLE:
${brief}

SOURCE MATERIAL (the only specific facts you may state):
${sourceMaterial?.trim() || "(none — write without specific factual claims about recent events)"}

${struct ? `${struct}

` : ""}Write the English master version. JSON shape:
{"title":"...","summary":"2 sentences","body":"Markdown, ${words || "600-900 words"}, ## subheadings, short paragraphs, the first paragraph is a gripping, honest hook (2-3 sentences) built on the most striking fact; plain, warm, concrete language, no flowery clichés","metaDescription":"max 155 chars","tags":["5-8 tags"],"imageQuery":"2-4 English words naming a PLACE, BUILDING or OBJECT for a stock photo that really matches the story (e.g. 'Mazar-e-Iqbal Lahore', 'Parliament building Islamabad', 'courtroom', 'cricket stadium', 'oil refinery'). NEVER people, children, families, women, villagers or poverty, and no real people's names. If no place or object clearly fits (for example a holiday announcement or a general notice), return an empty string","person":"full English name of the one public figure the story is mainly about (e.g. Imran Khan), or empty string","people":["full English names of every public figure named in the story (politicians, officials, leaders), as Wikipedia writes them"],"countries":["ISO 3166-1 alpha-2 codes, ONLY when the story is about relations, a deal, a dispute or a conflict BETWEEN two or more countries (then those countries); otherwise an empty list. A story about one country, or about Pakistan at home, gets an empty list"],"orgs":["international bodies central to the story, from: un, eu, oic, nato, arab-league, gcc, asean, au, sco, imf, world-bank"],"scene":"the one place photo that best fits as a card background, exactly one of: ${SCENE_KEYS.join(", ")}; or empty"${sections ? `,"category":"the best-fitting section, exactly one of: ${sections.join(", ")}. Rules: crime, police, courts, accidents and local incidents inside Pakistan = pakistan; politics = parties, government, parliament, elections, officials; economy = ONLY business, prices, budget, markets, trade, jobs; disaster = floods, quakes, mass-casualty accidents; sports, entertainment, world as named. A crime or police story is never politics or economy."` : ""}}`;

  return withRetry(async () => {
    const { text, usage, model } = await callAI({ system: EDITORIAL_RULES, prompt, maxTokens: 3500 });
    const data = parseJSON(text);
    if (!data.title || !data.body) throw new Error("Master article missing title/body");
    return { data, usage, model };
  });
}

export async function translate(master, lang) {
  const prompt = `Write this article in ${LANG_NOTES[lang]}
Keep the Markdown structure (the **Key points** bullet list, ## subheadings, paragraphs). Write the title and summary so they read like
real headlines and standfirsts in that language, not translations.
Return ONLY JSON: {"title":"...","summary":"...","body":"...","metaDescription":"..."}

SOURCE ARTICLE (English):
${JSON.stringify({
  title: master.title, summary: master.summary, body: master.body, metaDescription: master.metaDescription,
})}`;

  return withRetry(async () => {
    const { text, usage } = await callAI({ system: EDITORIAL_RULES, prompt, maxTokens: 6000 });
    const data = parseJSON(text);
    if (!data.title || !data.body) throw new Error(`${lang} version incomplete`);
    // The model sometimes writes a name in Bengali/Hindi/etc. inside Urdu text. Throwing makes withRetry ask again.
    if (lang === "ur" && urduHasForeignScript(data)) {
      // try to repair just the broken words (one small AI call) before giving up on the whole translation
      const { objs } = await repairForeignTokens([data]);
      if (urduHasForeignScript(objs[0])) throw new Error("ur version contains a non-Urdu script");
      return { data: objs[0], usage };
    }
    return { data, usage };
  });
}

/**
 * English master first, then ur/ar/de translated IN PARALLEL.
 * Total latency ≈ 1 generation + 1 translation, so it fits a serverless time limit.
 * A failed language doesn't block publishing; the site falls back to English for it.
 */
export async function generateMultilingual(input) {
  const started = input.startedAt || Date.now();
  const { data: master, usage, model } = await writeMaster(input);
  // Optional quality gate on the English master: when it fails, skip the translations (saves time and quota)
  const gate = input.gate ? await input.gate(master) : null;
  if (gate && !gate.pass) {
    return {
      master, gate, failedLangs: ["ur"], usage, model,
      translations: { en: { title: master.title, summary: master.summary, body: master.body, metaDescription: master.metaDescription } },
    };
  }
  // Serverless time limit: when writing and checking took long, translate only Urdu now (the site
  // falls back to English for the others)
  const others = ["ur"];   // Urdu only (Arabic and German switched off)
  const results = await Promise.allSettled(others.map((l) => translate(master, l)));

  const translations = {
    en: { title: master.title, summary: master.summary, body: master.body, metaDescription: master.metaDescription },
  };
  const failedLangs = [];
  const total = { ...usage };

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      translations[others[i]] = others[i] === "ur" ? cleanUrduFields(r.value.data) : r.value.data;
      total.inputTokens += r.value.usage.inputTokens;
      total.outputTokens += r.value.usage.outputTokens;
    } else {
      failedLangs.push(others[i]);
      console.error(`Translation ${others[i]} failed:`, r.reason?.message);
    }
  });

  return { master, translations, failedLangs, usage: total, model, gate };
}
