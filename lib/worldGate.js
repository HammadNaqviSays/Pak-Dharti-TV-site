// International news is only for the BIG stories: elections, wars and ceasefires, major leaders, disasters, and anything that touches Pakistan.
// Celebrity, lifestyle and most foreign sport is left out: Pakistani Urdu readers do not come for it.
const PAK = /\b(pakistan\w*|islamabad|karachi|lahore|peshawar|quetta|kashmir|imran khan|shehbaz|sharif|zardari|munir|asim munir|pti|psx|iran|afghan\w*|taliban|kabul|india\w*|modi|new delhi|china|chinese|beijing|saudi|riyadh|uae|dubai|emirates|gulf|turkey|turkiye|erdogan|oic|imf|world bank|gaza|palestin\w*|israel\w*|hamas|hezbollah|lebanon|syria\w*|yemen|houthi|iraq|qatar|doha|egypt|bangladesh|sri lanka|nepal|myanmar|rohingya)\b/i;
const BIG = /\b(elections?|vote[sd]?|voting|ballot|president\w*|prime minister|chancellor|parliament|congress|senate|white house|kremlin|summit|treaty|talks|negotiat\w*|ceasefire|truce|peace deal|war|invasion|offensive|missile\w*|airstrikes?|bomb\w*|attack\w*|terror\w*|killed|deaths?|dead|massacre|hostages?|sanctions?|tariffs?|nuclear|nato|united nations|\bun\b|security council|icc|earthquake|tsunami|floods?|hurricane|typhoon|wildfire|famine|pandemic|outbreak|coup|protests?|crackdown|impeach\w*|oil price\w*|opec|recession|trump|putin|zelensky\w*|netanyahu|xi jinping|biden|harris|macron|starmer|ukraine|russia\w*)\b/i;
const LOW = /\b(celebrit\w*|actor|actress|singer|rapper|album|movie|film|box office|netflix|royal family|prince|princess|kardashian|taylor swift|beyonce|fashion|recipe|horoscope|lottery|viral|zoo|tiktok star|influencer|premier league|transfer window|nba|nfl|mlb|nhl|ufc|wwe|golf|tennis|formula 1|f1|rugby|oscars?|grammy|emmys?|reality show|gossip|diet|lifestyle|travel guide|wedding|dating|sentenced to prison for sexual|sexual assault)\b/i;

/** True when an international story is big enough (or Pakistan-related) for the site. */
export function isMajorWorld(item = {}) {
  const t = `${item.title || ""} ${item.snippet || ""}`;
  if (PAK.test(t)) return true;                 // touches Pakistan or its neighbourhood: always interesting
  if (LOW.test(t)) return false;
  return BIG.test(item.title || "");            // otherwise the headline itself must be about a major event
}

/** True when the text itself touches Pakistan or its neighbourhood. */
export function touchesPakistan(text = "") {
  return PAK.test(text);
}
