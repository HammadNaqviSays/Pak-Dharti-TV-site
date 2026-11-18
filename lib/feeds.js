// Verify each URL before launch; feeds move. We use headline + snippet as facts,
// write original copy, and always link back to the source.
// match: only items whose title or text mention Pakistan are taken (for international outlets)
const PK = /pakistan|islamabad|karachi|lahore|peshawar|quetta|rawalpindi|balochistan|khyber|sindh|punjab|imran khan|shehbaz|asim munir|zardari|\bPTI\b|\bISPR\b/i;
export { PK as PAKISTAN_MATCH };
// Stricter match for foreign outlets (no "punjab"/"sindh"/"khyber" alone: Indian Punjab etc. would slip in)
const PKS = /pakistan|islamabad|karachi|lahore|peshawar|quetta|rawalpindi|balochistan|imran khan|shehbaz sharif|asim munir|zardari|\bISPR\b|\bPTI\b party|\bPCB\b/i;
export const FEEDS = [
  { id: "dawn",      name: "Dawn",            url: "https://www.dawn.com/feeds/home",             category: "pakistan" },
  { id: "tribune",   name: "Express Tribune", url: "https://tribune.com.pk/feed/home",            category: "pakistan" },
  { id: "bbc-world", name: "BBC News",        url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "world" },
  { id: "aljazeera", name: "Al Jazeera",      url: "https://www.aljazeera.com/xml/rss/all.xml",   category: "world" },
  { id: "gdacs",     name: "GDACS",           url: "https://www.gdacs.org/xml/rss.xml",           category: "disaster" },
  { id: "dawn-biz",  name: "Dawn",            url: "https://www.dawn.com/feeds/business",         category: "economy" },
  { id: "dawn-world",name: "Dawn",            url: "https://www.dawn.com/feeds/world",            category: "world" },
  { id: "tribune-biz", name: "Express Tribune", url: "https://tribune.com.pk/feed/business",      category: "economy" },
  { id: "geo",       name: "Geo News",        url: "https://www.geo.tv/rss/1/1",                  category: "pakistan" },
  { id: "bbc-asia",  name: "BBC News",        url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", category: "world" },
  { id: "tribune-sports", name: "Express Tribune", url: "https://tribune.com.pk/feed/sports",     category: "sports" },
  { id: "cricinfo",  name: "ESPNcricinfo",    url: "https://www.espncricinfo.com/rss/content/story/feeds/0.xml", category: "sports" },
  { id: "bbc-sport", name: "BBC Sport",       url: "https://feeds.bbci.co.uk/sport/rss.xml",      category: "sports" },
  // More Pakistani sources (Dawn sometimes refuses our server, so Pakistan needs more than one door).
  // A feed that does not answer is simply skipped and its error shows in the ingest log.
  { id: "thenews",   name: "The News",        url: "https://www.thenews.com.pk/rss/1/1",          category: "pakistan" },
  { id: "pakistantoday", name: "Pakistan Today", url: "https://www.pakistantoday.com.pk/feed/",   category: "pakistan" },
  { id: "brecorder", name: "Business Recorder", url: "https://www.brecorder.com/feeds/latest-news", category: "economy" },
  // More Dawn and The News sections (they are our main Pakistani sources)
  { id: "dawn-pakistan", name: "Dawn",        url: "https://www.dawn.com/feeds/pakistan",          category: "pakistan" },
  { id: "dawn-latest",   name: "Dawn",        url: "https://www.dawn.com/feeds/latest-news",       category: "pakistan" },
  { id: "dawn-sport",    name: "Dawn",        url: "https://www.dawn.com/feeds/sport",             category: "sports" },
  // International outlets, only their stories about Pakistan
  { id: "bbc-southasia", name: "BBC News",    url: "https://feeds.bbci.co.uk/news/world/south_asia/rss.xml", category: "pakistan", match: PK },
  { id: "guardian-pk",   name: "The Guardian", url: "https://www.theguardian.com/world/pakistan/rss", category: "pakistan" },
  { id: "bloomberg",     name: "Bloomberg",   url: "https://feeds.bloomberg.com/markets/news.rss", category: "economy", match: PK },
  { id: "nyt-world",     name: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", category: "pakistan", match: PK },
  { id: "cnn-world",     name: "CNN",         url: "http://rss.cnn.com/rss/edition_world.rss",     category: "pakistan", match: PK },
  { id: "france24",      name: "France 24",   url: "https://www.france24.com/en/asia-pacific/rss", category: "pakistan", match: PK },
 // Pakistan in the world's press: US, UK, Australia, New Zealand, Gulf, Europe, Asia (only their stories that mention Pakistan; a feed that fails is skipped)
  { id: "sky",        name: "Sky News",        url: "https://feeds.skynews.com/feeds/rss/world.xml",          category: "pakistan", match: PKS },
  { id: "guardian-world", name: "The Guardian", url: "https://www.theguardian.com/world/rss",                  category: "pakistan", match: PKS },
  { id: "independent", name: "The Independent", url: "https://www.independent.co.uk/news/world/rss",           category: "pakistan", match: PKS },
  { id: "npr",        name: "NPR",             url: "https://feeds.npr.org/1004/rss.xml",                     category: "pakistan", match: PKS },
  { id: "wapo",       name: "The Washington Post", url: "https://feeds.washingtonpost.com/rss/world",         category: "pakistan", match: PKS },
  { id: "abc-au",     name: "ABC News Australia", url: "https://www.abc.net.au/news/feed/2942460/rss.xml",    category: "pakistan", match: PKS },
  { id: "smh",        name: "The Sydney Morning Herald", url: "https://www.smh.com.au/rss/world.xml",         category: "pakistan", match: PKS },
  { id: "rnz",        name: "RNZ",             url: "https://www.rnz.co.nz/rss/world.xml",                    category: "pakistan", match: PKS },
  { id: "arabnews",   name: "Arab News",       url: "https://www.arabnews.com/rss.xml",                       category: "pakistan", match: PKS },
  { id: "dw",         name: "Deutsche Welle",  url: "https://rss.dw.com/rdf/rss-en-all",                      category: "pakistan", match: PKS },
  { id: "straitstimes", name: "The Straits Times", url: "https://www.straitstimes.com/news/asia/rss.xml",     category: "pakistan", match: PKS },
  // More countries: France, Germany (DW above), Canada, Turkey, Japan, India, Gulf, Europe, Bangladesh, Afghanistan
  { id: "france24-all", name: "France 24",      url: "https://www.france24.com/en/rss",                        category: "pakistan", match: PKS },
  { id: "euronews",   name: "Euronews",        url: "https://www.euronews.com/rss",                           category: "pakistan", match: PKS },
  { id: "cbc",        name: "CBC News",        url: "https://www.cbc.ca/webfeed/rss/rss-world",               category: "pakistan", match: PKS },
  { id: "anadolu",    name: "Anadolu Agency",  url: "https://www.aa.com.tr/en/rss/default?cat=world",         category: "pakistan", match: PKS },
  { id: "trt",        name: "TRT World",       url: "https://www.trtworld.com/rss",                           category: "pakistan", match: PKS },
  { id: "nhk",        name: "NHK World",       url: "https://www3.nhk.or.jp/nhkworld/en/news/feeds/",         category: "pakistan", match: PKS },
  { id: "japantimes", name: "The Japan Times", url: "https://www.japantimes.co.jp/feed/",                     category: "pakistan", match: PKS },
  { id: "thehindu",   name: "The Hindu",       url: "https://www.thehindu.com/news/international/feeder/default.rss", category: "pakistan", match: PKS },
  { id: "ndtv",       name: "NDTV",            url: "https://feeds.feedburner.com/ndtvnews-world-news",       category: "pakistan", match: PKS },
  { id: "gulfnews",   name: "Gulf News",       url: "https://gulfnews.com/rss?path=/world",                   category: "pakistan", match: PKS },
  { id: "khaleej",    name: "Khaleej Times",   url: "https://www.khaleejtimes.com/rss",                       category: "pakistan", match: PKS },
  { id: "dailystar-bd", name: "The Daily Star (Bangladesh)", url: "https://www.thedailystar.net/frontpage/rss.xml", category: "pakistan", match: PKS },
  { id: "tolo",       name: "TOLOnews",        url: "https://tolonews.com/rss.xml",                           category: "pakistan", match: PKS },
  // China, Russia, Azerbaijan (several are state outlets: every claim is attributed to them by name, never stated as our own)
  { id: "xinhua",     name: "Xinhua",          url: "http://www.xinhuanet.com/english/rss/worldrss.xml",      category: "pakistan", match: PKS },
  { id: "cgtn",       name: "CGTN",            url: "https://www.cgtn.com/subscribe/rss/section/world.xml",   category: "pakistan", match: PKS },
  { id: "chinadaily", name: "China Daily",     url: "http://www.chinadaily.com.cn/rss/world_rss.xml",         category: "pakistan", match: PKS },
  { id: "scmp",       name: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed",              category: "pakistan", match: PKS },
  { id: "tass",       name: "TASS",            url: "https://tass.com/rss/v2.xml",                            category: "pakistan", match: PKS },
  { id: "moscowtimes", name: "The Moscow Times", url: "https://www.themoscowtimes.com/rss/news",              category: "pakistan", match: PKS },
  { id: "trend",      name: "Trend News Agency", url: "https://en.trend.az/feeds/index.rss",                  category: "pakistan", match: PKS },
  { id: "apa",        name: "APA",             url: "https://apa.az/en/rss",                                  category: "pakistan", match: PKS },
  { id: "azernews",   name: "AZERNEWS",        url: "https://www.azernews.az/rss.php",                        category: "pakistan", match: PKS },
  // More Pakistani outlets (a feed that does not answer is skipped; the ingest log shows it) + worldwide Imran Khan / PTI watch
  { id: "ary",        name: "ARY News",        url: "https://arynews.tv/feed/",                    category: "pakistan" },
  { id: "samaa",      name: "Samaa",           url: "https://www.samaa.tv/feed",                   category: "pakistan" },
  { id: "92news",     name: "92 News",         url: "https://92newshd.tv/feed",                    category: "pakistan" },
  { id: "gnews-imran", name: "Google News",    url: "https://news.google.com/rss/search?q=%22Imran+Khan%22+OR+%22PTI%22&hl=en-PK&gl=PK&ceid=PK:en", category: "pakistan" },
  { id: "positive",  name: "Positive News",   url: "https://www.positive.news/feed/",             category: "inspirational" },
];
