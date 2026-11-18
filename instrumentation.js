// Writes the real reason of any page error to the Worker log (production hides it from the browser, showing only a "Digest").
export async function onRequestError(err, request, context) {
  try {
    console.error(`[page-error] ${request?.path} digest=${err?.digest} :: ${err?.message}\n${String(err?.stack || "").split("\n").slice(0, 8).join("\n")}`);
  } catch {}
}
