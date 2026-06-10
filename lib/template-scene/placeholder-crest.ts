import type { BindingPreviewMode, ImageBindingKey } from "./index";

function getPrimaryColor(
  isHome: boolean,
  previewMode: BindingPreviewMode,
): string {
  if (isHome) {
    return previewMode === "preview" ? "#2563eb" : "#1d4ed8";
  }
  return previewMode === "preview" ? "#dc2626" : "#b91c1c";
}

export function createPlaceholderCrestSvg(
  bindingKey: ImageBindingKey,
  previewMode: BindingPreviewMode = "preview",
): string {
  const isHome = bindingKey === "homeClubLogo";
  const primary = getPrimaryColor(isHome, previewMode);
  const secondary = isHome ? "#dbeafe" : "#fee2e2";
  const label = isHome ? "HOME" : "AWAY";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="${secondary}"/><path d="M120 20 198 52v62c0 52-32 91-78 106-46-15-78-54-78-106V52l78-32Z" fill="${primary}"/><path d="M120 48 172 70v42c0 36-20 62-52 76-32-14-52-40-52-76V70l52-22Z" fill="#fff" fill-opacity=".92"/><text x="120" y="132" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="${primary}">${label}</text></svg>`;
}

export function createPlaceholderCrestDataUrl(
  bindingKey: ImageBindingKey,
  previewMode: BindingPreviewMode = "preview",
): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(createPlaceholderCrestSvg(bindingKey, previewMode))}`;
}
