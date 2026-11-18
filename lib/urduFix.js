// Repairs Urdu text in which the model put letters of another script inside Urdu words
// (e.g. "فوجی" written as "ফوجی", or a name written in Bengali). One AI call corrects the distinct broken words of
// many stories; only corrections that contain no foreign letters are accepted.
import { callAI, parseJSON, withRetry } from "./ai";
import { cleanUrdu, hasForeignScript, foreignTokens, replaceForeignTokens } from "./urdu";

const FIELDS = ["title", "summary", "body", "metaDescription"];
const MAX_TOKENS = 100;

/** objs: array of { title, summary, body, metaDescription } (Urdu). Returns { objs, stats } with the repaired copies. */
export async function repairForeignTokens(objs) {
  const seen = new Map();
  for (const o of objs) for (const k of FIELDS) {
    const t = o?.[k];
    for (const tok of foreignTokens(t)) {
      if (tok.length > 40) continue; // not a single word: needs a full rewrite
      const e = seen.get(tok) || { tok, n: 0, ctx: "" };
      e.n++;
      if (!e.ctx) { const at = t.indexOf(tok); e.ctx = t.slice(Math.max(0, at - 45), at + tok.length + 45).replace(/\s+/g, " "); }
      seen.set(tok, e);
    }
  }
  const list = [...seen.values()].sort((a, b) => b.n - a.n).slice(0, MAX_TOKENS);
  const stats = { found: seen.size, asked: list.length, fixed: 0, rejected: 0, error: "", why: {}, samples: [] };
  if (!list.length) return { objs, stats };

  // Ask by NUMBER (not by the broken word itself): the model garbles right-to-left/mixed-script words when asked to echo them.
  const ask = async (items, retryNote, prefer) => {
    try {
      return await withRetry(async () => {
        const { text } = await callAI({
          system: "You correct broken Urdu news text. You reply with JSON only.",
          prompt: `Each numbered item is a word from an Urdu news story in which letters were written in the wrong script (mostly Bengali, sometimes Hindi or Chinese) by mistake. It is NOT a word to copy: you must REWRITE it in the Urdu alphabet (Perso-Arabic script). Work out which Urdu word or name was meant: Bengali-script letters often spell an English or Urdu word by sound (e.g. ফিল্ড = فیلڈ, ক্যাম্প = کیمپ), and a single Bengali letter inside an Urdu word is just a typo for the matching Urdu letter. Use the context to pick the right word and spell it the way Pakistani Urdu newspapers do (Real Madrid = ریال میڈرڈ). The answer must contain ONLY Urdu letters: no Bengali, no Hindi, no Latin. If you really cannot tell, give an empty string.${retryNote}
Return ONLY JSON like {"1":"<Urdu word>","2":"<Urdu word>"} using the item numbers.

${items.map((e, i) => `${i + 1}. ${e.tok}   (context: ${e.ctx})`).join("\n")}`,
          maxTokens: 4000, prefer,
        });
        const o = parseJSON(text);
        if (!o || typeof o !== "object") throw new Error("no JSON map");
        return o;
      });
    } catch (e) { stats.error = String(e.message || e).slice(0, 200); return null; }
  };
  const valid = (raw) => {
    const u = typeof raw === "string" ? cleanUrdu(raw.trim()) : "";
    return u && !hasForeignScript(u) && !/[A-Za-z]{4,}/.test(u) ? u : "";
  };
  const good = {};
  let todo = list;
  const reasons = {};
  for (let pass = 0; pass < 2 && todo.length; pass++) {
    const map = await ask(todo, pass ? "\nYour previous answer for some items still contained non-Urdu letters. Write every answer ONLY with Urdu (Perso-Arabic) letters." : "", pass ? ["gemini-2.5-flash", "gemini-3-flash-preview"] : ["gemini-3-flash-preview", "gemini-2.5-flash"]);
    if (!map) break;
    const next = [];
    todo.forEach((e, i) => {
      const raw = map[String(i + 1)];
      const u = valid(raw);
      if (u && u.length <= e.tok.length * 3 + 6 && u.split(/\s+/).length <= 4) { good[e.tok] = u; return; }
      reasons[e.tok] = [raw, raw === undefined ? "missing" : typeof raw !== "string" ? "not-text" : !raw.trim() ? "empty" : hasForeignScript(raw) ? "still-foreign" : /[A-Za-z]{4,}/.test(raw) ? "latin" : "too-long"];
      next.push(e);
    });
    todo = next;
  }
  for (const e of todo) {
    stats.rejected++;
    const [raw, why] = reasons[e.tok] || [undefined, "no-answer"];
    stats.why[why] = (stats.why[why] || 0) + 1;
    if (stats.samples.length < 4) stats.samples.push(`${e.tok} → ${typeof raw === "string" ? raw.slice(0, 30) : "(none)"} [${why}]`);
  }
  stats.fixed = Object.keys(good).length;
  const out = objs.map((o) => {
    if (!o) return o;
    const c = { ...o };
    for (const k of FIELDS) c[k] = replaceForeignTokens(c[k], good);
    return c;
  });
  return { objs: out, stats };
}
