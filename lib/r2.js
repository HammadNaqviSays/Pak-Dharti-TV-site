// The R2 storage where finished reel videos live (binding REELS_R2). Returns null when it is not there (local build), so callers fall back.
export async function reelsBucket() {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return ctx?.env?.REELS_R2 || null;
  } catch { return null; }
}
