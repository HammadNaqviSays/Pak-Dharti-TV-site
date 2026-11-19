// Where to anchor a story picture when it is cropped (phone cards, wide cards): on the face, not the middle.
// image.focusY / focusX are percentages (0-100) found by lib/faceFocus.js. Without them the CSS default (upper part of the picture) is used.
export function focusStyle(a) {
  const y = Number(a?.image?.focusY), x = Number(a?.image?.focusX);
  if (!Number.isFinite(y)) return undefined;
  return { objectPosition: `${Number.isFinite(x) ? Math.round(x) : 50}% ${Math.round(y)}%` };
}
