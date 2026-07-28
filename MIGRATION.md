# Canvas-only migration guide

This major release removes the SVG wheel renderer. Canvas is now the sole wheel renderer, and the `renderer` and `canvasThreshold` props have been removed.

Move visual customisation from SVG selectors to the public API:

- `.wheel__sector`, `.wheel__svg`, `.wheel__svg path`, `.wheel__svg line`, and `.wheel__svg text` no longer exist;
- styling individual SVG `path`, `line`, and `text` nodes must be replaced with `theme` and per-item `color`, `text`, and `image` options;
- use `highlightedItemId` with `highlightStyle` instead of a highlighted SVG sector selector;
- SVG export is not supported. Canvas is painted after hydration; server rendering provides a sized circular fallback and the semantic item list, not a server-rendered wheel poster;
- `collapse` uses Canvas LOD: full up to 50 sectors, simplified through 150, and crossfade above that limit.

Use `accessibleItemList={false}` only when the application renders an equivalent external semantic prize list.
