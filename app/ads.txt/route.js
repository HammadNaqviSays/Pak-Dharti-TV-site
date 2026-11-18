// Tells ad networks which AdSense account may sell ads on this site (needs NEXT_PUBLIC_ADSENSE_CLIENT, e.g. ca-pub-1234567890123456)
export const revalidate = 86400;

export function GET() {
  const pub = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "").replace(/^ca-/, "");
  if (!/^pub-\d{8,}$/.test(pub)) return new Response("Not found", { status: 404 });
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
