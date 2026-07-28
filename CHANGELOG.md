# Changelog

## Unreleased

### Breaking changes

- Removed the SVG wheel renderer and `WheelSvgRenderer` implementation.
- Removed the `renderer` and `canvasThreshold` props and the `WheelRenderer` type export.
- Removed the `.wheel__svg` and `.wheel__sector` CSS hooks, including selectors for their SVG `path`, `line`, and `text` descendants.
- Removed SVG-specific geometric `collapse` transitions. Canvas now applies its documented LOD collapse policy for every wheel.

See [MIGRATION.md](./MIGRATION.md) for the replacement APIs and SSR behavior.
