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

// ---- Sport: only what Pakistani readers care about ----
// Kept: anything that touches Pakistan, international cricket (Tests, ODIs, T20Is, ICC events, series between countries, big cases such as ball tampering or bans),
// and the big global events (Olympics, Asian / Commonwealth Games, FIFA World Cup). Left out: club football and its leagues, Formula 1 and other motor racing,
// foreign franchise leagues (IPL, BBL, NBA ...) and the other foreign sports, unless Pakistan is part of the story.
const PAK_SPORT = /\b(psl|pakistan super league|pcb|babar azam|rizwan|shaheen afridi|fakhar zaman|naseem shah|shadab khan|haris rauf|arshad nadeem|mohsin naqvi|green shirts|men in green|pakistani)\b/i;
const PAK_PLACE = /\b(pakistan\w*|karachi|lahore|islamabad|peshawar|quetta|multan|rawalpindi|faisalabad|sialkot)\b/i;
const FRANCHISE = /\b(ipl|indian premier league|bbl|big bash|cpl|caribbean premier league|sa20|ilt20|the hundred|major league cricket|\bmlc\b|lpl|lanka premier league|bpl|wpl|vitality blast|county championship|ranji|sheffield shield|syed mushtaq|duleep|royal london cup)\b/i;
const OTHER_SPORT = /\b(formula 1|formula one|\bf1\b|grand prix|motogp|nascar|indycar|premier league|la liga|serie a|bundesliga|ligue 1|champions league|europa league|conference league|nations league|fa cup|carabao|efl|mls|copa|transfer (window|news|rumou?rs?)|manchester (united|city)|liverpool|arsenal|chelsea|tottenham|real madrid|barcelona|bayern|juventus|psg|nba|nfl|mlb|nhl|ufc|wwe|golf|tennis|atp|wta|wimbledon|grand slam|rugby|boxing|nba finals|super bowl|cycling|tour de france)\b/i;
const MAJOR_EVENT = /\b(olympics?|olympic games|asian games|commonwealth games|fifa world cup|world cup|icc|champions trophy|asia cup|t20 world cup)\b/i;
const CRICKET = /\b(cricket\w*|test match|tests?|odi|odis|t20i?|ashes|bcci|ecb|cricket australia|border[- ]gavaskar|ball[- ]tamper\w*|captain|batter|bowler|wicket|innings)\b/i;

/** False for sport stories the site does not want. Stories that are not about sport always pass. */
export function isWantedSport(item = {}) {
  const t = `${item.title || ""} ${item.snippet || ""}`;
  const sporty = item.category === "sports" || OTHER_SPORT.test(t) || FRANCHISE.test(t);
  if (!sporty) return true;
  if (PAK_PLACE.test(t) || PAK_SPORT.test(t)) return true;   // not touchesPakistan(): it also matches "Indiana", "China" ...
  if (FRANCHISE.test(t) || OTHER_SPORT.test(t)) return false;
  if (MAJOR_EVENT.test(t)) return true;
  return CRICKET.test(t);
}
