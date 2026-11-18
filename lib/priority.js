// Stories that must go up first (emergency desk): Imran Khan, PTI and its leadership, his family.
// Used by the newsroom: these skip the daily quota and the "big world story" gate, are written first,
// and are placed in the breaking slot. The quality check still applies.
export const PRIORITY_SOURCE = "imran khan|عمران خان|\\bPTI\\b|پی ٹی آئی|tehreek-e-insaf|تحریک انصاف|bushra bibi|بشریٰ بی بی|بشری بی بی|aleema khan|علیمہ خان|uzma khanum|uzma khan|عظمیٰ خان|noreen niazi|نورین نیازی|barrister gohar|gohar ali khan|گوہر علی خان|omar ayub|عمر ایوب|salman akram raja|سلمان اکرم راجہ|sohail afridi|سہیل آفریدی|ali amin gandapur|گنڈاپور|asad qaiser|اسد قیصر|shibli faraz|latif khosa|لطیف کھوسہ|shah mahmood qureshi|شاہ محمود قریشی|hammad azhar|حماد اظہر|adiala|اڈیالہ|sheikh waqas akram|زلفی بخاری|zulfi bukhari";
export const PRIORITY_RE = new RegExp(PRIORITY_SOURCE, "i");
export const isPriority = (item) => PRIORITY_RE.test(`${item?.title || ""} ${item?.snippet || ""}`);

// Stories about Imran Khan / PTI that read as adverse (allegations, verdicts, crackdowns, splits …) are NOT published by the
// autopilot: they wait in the review queue and the editor decides. Nothing is deleted or rewritten.
export const ADVERSE_RE = /convict|sentenc|guilty|verdict|corrupt|scandal|fraud|embezzl|treason|terror|riot|arson|violence|violent|attack on|vandal|defect|split|rift|quit|resign|abandon|desert|disqualif|ban(ned)?\b|crackdown|arrest|bail (rejected|denied|dismissed)|rejects bail|dismiss|allegation|accus|charged|case against|reference against|tosha ?khana|£190|190 million|al-qadir|may 9|9 may|سزا|مجرم|قصوروار|بدعنوان|کرپشن|الزام|مقدمہ|گرفتار|نااہل|دہشت|توڑ پھوڑ|جلاؤ گھیراؤ|9 مئی|استعفیٰ|چھوڑ دی|علیحدگی/i;
export const isAdverse = (text) => ADVERSE_RE.test(String(text || ""));

// Court / official reporting is a fact of the day and is published (written neutrally, see PTI_BRIEF). Only adverse stories that rest
// on someone's allegation alone (no court, police or official statement) wait for the editor.
export const COURT_RE = /court|judge|bench|hearing|petition|verdict|ruling|bail|\bIHC\b|supreme|tribunal|police|FIA|NAB|commission|official|spokes(man|person)|عدالت|جج|کورٹ|سماعت|درخواست|ضمانت|فیصلہ|پولیس|ایف آئی اے|نیب|کمیشن|ترجمان/i;
export const isAdverseAllegationOnly = (text) => isAdverse(text) && !COURT_RE.test(String(text || ""));
export const PTI_BRIEF = " This story concerns Imran Khan or PTI: report it fairly and neutrally. State what the court, police or official body actually did or said and name it; give the PTI / the party's lawyers' / the family's response or position whenever the sources have it; use plain verbs (said, ordered, adjourned, filed), never loaded words (notorious, disgraced, scandal-hit, so-called); do not speculate about guilt, motives or outcomes; allegations are attributed to who made them and described as allegations; keep the headline plain and factual.";
