// Every NEWS story follows the same four-part shape plus a short "Key points" box, so readers (and search and
// answer engines) can get the facts at a glance. Features, opinion and stories keep their own shapes.
export const NEWS_STRUCTURE = `REQUIRED STRUCTURE FOR THIS NEWS STORY (this overrides the generic body description below):
1. KEY POINTS: the body starts with the bold line **Key points** (Urdu: **اہم نکات**) followed by exactly 3 short bullet
   points ("- ...", one sentence each) with the most important confirmed facts. No claim here that is not in the story.
2. LEAD (no subheading): one tight paragraph of 2-3 sentences that answers who, what, when and where, built on the
   most important confirmed fact, with the source credited ("according to Dawn", «ڈان کے مطابق»).
3. KEY DETAILS (## subheading): the verified specifics: names, figures, dates, places, official statements, each
   credited to its source; unconfirmed claims framed as such; conflicting figures shown side by side.
4. CONTEXT AND IMPACT (## subheading): why it matters, the background a new reader needs, who is affected and what it
   means for Pakistan or the region. Only background that is in the SOURCE MATERIAL or is well-established general
   knowledge; no speculation presented as fact.
5. SUMMARY AND WHAT NEXT (## subheading): two or three sentences closing the story: the bottom line and what is
   still unknown or expected next (only what the sources say).
Tone: neutral, professional, no opinion, no exclamation marks. Each part may have one to three short paragraphs.
Headline: clear, search-friendly, under 12 words, with the main subject near the start; honest, no clickbait.
Do not pad: if the sources are short, the article is short. Keep Key points and the lead always; keep a later part to a
sentence or two, or leave it out, when the sources give nothing real to say there.`;

