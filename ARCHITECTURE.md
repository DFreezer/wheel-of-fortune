# React Wheel of Fortune — architecture and roadmap

## 1. Library goals

The library provides a responsive React wheel with:

- weighted sectors and stable item IDs;
- client-side and server-side winner resolution;
- precise landing inside the winning sector;
- deep customization through themes, per-sector options, and render slots;
- images, SVG, GIF, and WebM content in the overlay, center, and pointer slots;
- spin, tick, win, pointer, idle, and item-list animations;
- sound effects and accessible status announcements;
- smooth animation at the display refresh rate;
- a dense mode for 100–1000+ items.

Geometry, winner selection, and rotation control should stay independent from React and from the renderer. The React component is an adapter over a headless core.

## 2. Module boundaries

```text
core/
  geometry        weights, angles, hit testing, landing
  selection       client-side weighted winner selection
  spin            target angle, easing, animation lifecycle
  transitions     interpolation between item geometries

react/
  Wheel           responsive container and visual layers
  useWheel        imperative controller integration
  SvgRenderer     fully customizable renderer
  CanvasRenderer  dense renderer for large item collections
  media           image/SVG/GIF/WebM helpers
  audio           spin/tick/win sound handling
```

The first release can remain a single npm package. Splitting the core and renderers into separate public packages should wait until the API is stable.

## 3. Data model

Every item has a stable unique `id`. Sector size is expressed as `weight`; the library normalizes the total to the full circle. This supports percentages, points, or probabilities without precomputing angles in the application.

```ts
export interface WheelItem<T = unknown> {
  id: string;
  label: string;
  weight: number;
  data?: T;
  color?: string;
  image?: string | {
    src: string;
    opacity?: number;
    fit?: 'cover' | 'contain' | 'stretch';
    scale?: number;
    rotation?: number;
    offsetX?: number;
    offsetY?: number;
  };
  text?: Partial<SectorTextStyle>;
  disabled?: boolean;
}

export interface SectorTextStyle {
  color: string;
  fontFamily: string;
  fontSize: number | string;
  fontWeight: number | string;
  radius: number;
  offsetX: number;
  offsetY: number;
  orientation: 'radial' | 'tangential' | 'horizontal';
  align: 'start' | 'middle' | 'end';
  overflow: 'hide' | 'ellipsis' | 'shrink';
  strokeColor: string;
  strokeWidth: number;
  shadow: { color: string; blur: number; offsetX: number; offsetY: number };
}
```

Validation rules:

- IDs must be unique;
- weights must be finite and non-negative;
- zero-weight and disabled items do not participate in selection;
- an empty wheel cannot spin;
- labels in very small sectors are hidden or simplified by the detail policy.

## 4. Public API

Use a controlled `items` prop. The parent adds, removes, or edits an item by updating its React state. Separate `addItem()` and `removeItem()` methods would create a second source of truth and complicate server synchronization.

The imperative controller is reserved for command-like actions:

```ts
export interface WheelController {
  spin(options?: SpinRequest): Promise<SpinResult>;
  cancel(reason?: string): void;
  getState(): WheelState;
}

type SpinRequest =
  | { mode: 'client'; landing?: LandingConfig; animation?: Partial<SpinAnimationConfig> }
  | {
      mode: 'server';
      winnerId?: string;
      resolveWinner?: ({ signal }: { signal: AbortSignal }) => Promise<string | { winnerId: string }>;
      landing?: LandingConfig;
      animation?: Partial<SpinAnimationConfig>;
    };
```

Useful callbacks include `onSpinStart`, `onSectorPass`, `onSpinEnd`, `onSpinCancel`, `onItemsTransitionStart`, `onItemsTransitionEnd`, and `onError`.

`resolveWinner` requests an authoritative result after the click. The state moves through `idle → resolving → spinning → idle`; `cancel()` aborts the provided signal. A visual pre-spin while the request is pending remains a separate future UX mode.

## 5. Layers and customization

The default layer order is:

```text
pointer          pointer artwork and bounce animation
center           center content, above the overlay
overlay          frame or decorative animation
wheel-content    sectors, labels, dividers, and outer border
```

`overlay`, `center`, and `pointer` accept `ReactNode`, so applications can use PNG, SVG, GIF, or WebM without a new library type. `WheelMedia` is a convenience helper that configures image and video elements with safe defaults.

`centerSize` controls the center slot independently from its content. A sector image is clipped to the sector wedge and rendered above the color; transparent pixels keep the underlying fill visible. Both SVG and Canvas clip labels to the wedge and apply ellipsis before rendering when the available arc is too short.

Customization has three levels:

1. `theme` for wheel-wide defaults;
2. fields on an individual `WheelItem` for sector-specific overrides;
3. render slots, `className`, and CSS variables for replacing visual pieces.

The outer border and dividers are drawn separately from sector fills. Stroking every sector would double shared lines and make their thickness inconsistent.

## 6. Geometry and landing

For item `i`, the normalized sector angle is:

```text
sectorAngle[i] = 2π × weight[i] / totalWeight
start[i]       = sum of previous sector angles
end[i]         = start[i] + sectorAngle[i]
```

The pointer stays fixed while the wheel layer rotates. The final angle is computed before the animation so the selected sector center, or a safe random point inside it, aligns with the pointer after several complete rotations.

```ts
type LandingConfig = {
  mode: 'center' | 'random';
  edgePadding?: number;
};
```

Random landing uses `edgePadding` so the pointer does not visually land on a divider. A server can return a normalized landing offset in a future protocol for reproducible server-side results.

Client-side selection uses `crypto.getRandomValues()` and the item weights. The library does not claim cryptographic fairness for a complete promotion; valuable prizes should use the server as the source of truth.

## 7. Spin animation

Only one compositor-friendly layer should animate with `transform: rotate(...)`. Web Animations API or generated keyframes keep React out of the per-frame path and allow 60/90/120/144 Hz displays to use their native refresh rate.

`requestAnimationFrame` is used only for logical angle tracking and sector-pass events. Sector components do not re-render during the spin.

“60+ FPS” is a measurable target rather than a guarantee for every device:

- no React render on every frame;
- one transform animation for the wheel;
- no layout read/write loops;
- frame time below 16.7 ms at 60 Hz and below 8.3 ms at 120 Hz on the agreed test device.

## 8. Pointer and audio

Crossing a sector boundary emits `sectorPass`. It starts a short pointer animation with a backward deflection, a quick return, and a small overshoot. At high wheel speed, many boundaries can be crossed in one frame, so ticks are coalesced and rate-limited to prevent pointer and audio overload.

Short, precise sounds are best handled by Web Audio API. Browsers require a user gesture to activate an audio context, so the docs should explain autoplay policy. Callbacks remain available for applications that provide their own audio engine.

## 9. Item-list transitions

When the wheel is idle, item changes use a shared transition configuration:

- `crossfade` fades old geometry into the new geometry;
- `collapse` interpolates stable sector boundaries, contracting removed sectors between neighbors and expanding added sectors from their shared boundary;
- Canvas/dense mode falls back to a light `crossfade` to avoid animating hundreds of SVG paths;
- labels remain attached to their current item geometry and stay clipped to the wedge.

Per-frame custom animation for every sector is unnecessary for the first public release. A common mode, duration, and easing provide predictable performance. Changes during a spin use a stable snapshot and are applied after the spin by default; `itemsChangeBehavior: 'defer' | 'cancel-spin'` can make that policy explicit.

## 10. Responsive behavior

The root uses `aspect-ratio: 1`, while `size` is resolved relative to the container. `minSize`, `maxSize`, `className`, and `style` let the host application control layout with ordinary CSS.

SVG uses a stable `viewBox`, so geometry scales without recalculation. A `ResizeObserver` tracks the container. Canvas multiplies the backing bitmap by `devicePixelRatio` with a configurable cap to avoid excessive 4K/Retina memory use.

## 11. Dense mode for 100–1000+ items

A thousand labels cannot be readable inside one circle. This is a presentation limit, not a selection or geometry limit, so the renderer uses level of detail (LOD) without changing probabilities:

- SVG remains the default renderer for maximum customization;
- Canvas is preferred for large collections;
- `auto` selects the renderer from item count and render-slot complexity;
- labels disappear when their arc or pixel length is too small;
- dense mode can show only the selected/hovered item and an external name display;
- dense dividers are omitted when they would become a solid ring;
- hit testing uses angle lookup and binary search rather than one DOM node per item.

An initial policy is SVG up to 100 items, SVG or Canvas from 100 to 300 with hidden small labels, and Canvas from 300 onward. The threshold should be confirmed with benchmarks that also consider wheel size, weights, and custom renderer complexity.

## 12. Accessibility

- provide an `aria-label` for the wheel;
- announce the winner through a live region;
- let the application decide where its spin button lives;
- respect `prefers-reduced-motion` with shorter or disabled animation;
- provide an accessible external item list in dense mode;
- mark decorative overlay content as `aria-hidden` by default.

## 13. Implementation status and roadmap

### Current status

- geometry, React API, SVG, Web Animations, client/server winners, cancellable `resolveWinner`, pointer animation, and URL/file sounds are implemented;
- controlled `crossfade` and geometric SVG `collapse` animate stable add/remove changes; Canvas uses the safe `crossfade` fallback;
- `renderer="auto"` switches to Canvas from 300 sectors, caps bitmap DPR, applies LOD, and supports geometric hit testing in both renderers;
- deterministic tests cover normalization, boundaries, weighted selection, landing, validation, and cancellation;
- open work includes an external accessible dense-item list, browser lifecycle tests, performance benchmarks, and visual regression coverage.

### Release stages

1. **Headless core** — public types, normalization, geometry, landing, and math tests.
2. **React and SVG** — responsive container, sectors, labels, dividers, layers, controlled items, and examples.
3. **Spin, pointer, and audio** — easing, duration, sector-pass events, bounce, client/server modes, cancellation, and landing tests.
4. **Dynamic items** — stable-ID diffing, reorder policies, snapshots, and rapid-update tests.
5. **Dense mode** — Canvas, DPR scaling, LOD, DOM-free hit testing, and 100/300/1000-item benchmarks.
6. **Release hardening** — bundle size, tree shaking, API reference, recipes, migration policy, prereleases, and feedback before `1.0.0`.

## 14. First public release criteria

- the same `winnerId` always lands in the correct sector;
- random landing never touches a divider;
- `items` can be updated safely before, after, and during a spin;
- all visual layers scale with the container;
- rotation does not trigger a React render on every frame;
- 1000 items work in dense/Canvas mode without promising 1000 readable labels;
- geometry, client-side distribution, server-side results, and cancellation have tests;
- applications can replace the pointer, overlay, and center and customize every sector.

## 15. Product decisions

1. `items` is a controlled prop; the base API does not expose separate add/remove methods.
2. The imperative API is limited to `spin`, `cancel`, and state inspection.
3. SVG is the primary renderer; Canvas is the optimized dense renderer.
4. Add/remove uses one shared transition configuration instead of a separate animation engine per sector.
5. Server mode accepts a ready `winnerId` or `resolveWinner({ signal })`; the server response remains authoritative.
6. For 1000+ items, exact selection is preserved while labels and dividers are simplified automatically.
