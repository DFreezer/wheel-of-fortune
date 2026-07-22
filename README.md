# React Wheel of Fortune

<p align="center">
  <img
    src="https://raw.githubusercontent.com/DFreezer/wheel-of-fortune/main/src/assets/realistic-space/wheel.png"
    alt="Wheel of Fortune preview"
    width="520"
  />
</p>

A working MVP of a customizable wheel-of-fortune library for React, plus an interactive playground for exploring the API.

## Live demo

Explore the interactive playground at [customizablewheel.netlify.app](https://customizablewheel.netlify.app/).

## Run the playground

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`). Run a production build with:

```bash
npm run build
```

## Install the library

```bash
npm install @cxde/wheel-of-fortune
```

Import the stylesheet once from your application entry point:

```tsx
import '@cxde/wheel-of-fortune/style.css';
```

The geometry and winner-selection checks run without an additional test runner:

```bash
npm test
```

## Implemented features

- sectors with arbitrary weights, colors, transparent image layers above the color, and per-sector text styles;
- labels clipped to the sector wedge; long text uses an ellipsis by default, with `hide` and `shrink` alternatives;
- configurable wheel borders, text strokes and shadows, and divider shadows;
- client-side weighted selection using `crypto.getRandomValues`, server-side selection through `winnerId`, and an asynchronous `resolveWinner` with `AbortSignal`;
- landing at the center or at a random point inside the winning sector with safe edge padding;
- Web Animations API spin with a single rotating layer, no React render on every frame, custom CSS `easing`, duration, and rotation count;
- pointer bounce animation, sector-pass events, and pointer placement at the top or right (`pointerPosition`);
- `overlay`, `center`, and `pointer` as `ReactNode`, supporting `<img>`, inline SVG, GIF, and `<video>`; `centerSize` controls the center slot size;
- responsive sizing through `size`, including values such as `"50%"` inside a container;
- `spin`/`tick`/`win` sounds from a URL or a local `File`/`Blob`;
- a controlled `items` list: add and remove items by updating React state, with `crossfade`, geometric `collapse`, or no animation while idle;
- optional idle animation (subtle tilt and pulse) on a compositor layer; the pointer reacts to sector-boundary crossings through the same bounce/tick event;
- `renderer="auto"`: SVG for up to 299 sectors and Canvas from 300; Canvas caps DPR and hides labels/dividers that would no longer be readable;
- explicit `renderer="svg"` and `renderer="canvas"` modes, plus `canvasThreshold` and `maxCanvasDpr`;
- geometric hit testing, hover, click, and controlled visual highlighting (`onSectorHover`, `onSectorClick`, `highlightedItemId`) in both renderers;
- `WheelMedia` for quickly connecting image/GIF/WebM content to `overlay`, `center`, and `pointer`;
- `prefers-reduced-motion`: spin and transitions are shortened, and the winner is announced through a live region.

## Minimal usage

```tsx
import { useState } from 'react';
import { Wheel, useWheel, type WheelItem } from '@cxde/wheel-of-fortune';
import '@cxde/wheel-of-fortune/style.css';

function PrizeWheel() {
  const wheel = useWheel();
  const [items, setItems] = useState<WheelItem[]>([
    {
      id: 'bonus', label: 'A super-long bonus for a new customer', weight: 70, color: '#7c3aed',
      image: { src: '/sparkles.png', opacity: 0.55, fit: 'cover' },
      text: { overflow: 'ellipsis', strokeColor: '#312e81', strokeWidth: 0.25 },
    },
    { id: 'gift', label: 'Gift', weight: 30, color: '#db2777' },
  ]);

  return (
    <>
      <Wheel
        controller={wheel}
        items={items}
        size="100%"
        renderer="auto"
        canvasThreshold={300}
        itemsTransition={{ mode: 'collapse', duration: 360, easing: 'cubic-bezier(.22, 1, .36, 1)' }}
        spinAnimation={{
          duration: 4200,
          rotations: { min: 5, max: 7 },
          easing: 'cubic-bezier(.12, .82, .18, 1)',
        }}
        overlay={<img src="/frame.svg" alt="" />}
        center={<img src="/logo.gif" alt="" />}
        centerSize="32%"
        pointerPosition="right"
        idleAnimation={{ enabled: true, duration: 3200, rotation: 0.5, scale: 1.01 }}
        onSpinEnd={({ winner }) => console.log(winner)}
      />
      <button onClick={() => wheel.spin({ mode: 'client' })}>Spin</button>
      <button onClick={() => wheel.spin({ mode: 'server', winnerId: 'gift' })}>
        Select the server-side gift
      </button>
    </>
  );
}
```

## Asynchronous server result

Use `resolveWinner` when the authoritative result should be requested immediately after the user clicks. While the promise is pending, `getState()` returns `status: 'resolving'`; item updates are deferred and `cancel()` propagates through `AbortSignal`.

```tsx
await wheel.spin({
  mode: 'server',
  resolveWinner: async ({ signal }) => {
    const response = await fetch('/api/spins', { method: 'POST', signal });
    const { winnerId } = await response.json();
    return { winnerId, landing: { mode: 'random', edgePadding: 0.15 } };
  },
});
```

For dense wheels, SVG and Canvas expose the same sector events. `highlightedItemId` provides controlled highlighting without relying on individual DOM nodes:

```tsx
<Wheel
  items={items}
  renderer="auto"
  highlightedItemId={hoveredId}
  onSectorHover={(sector) => setHoveredId(sector?.item.id)}
  onSectorClick={({ item }) => setServerWinnerId(item.id)}
/>
```

Detailed architectural decisions and future work are documented in [ARCHITECTURE.md](./ARCHITECTURE.md).

In SVG, `collapse` interpolates sector boundary angles: a removed wedge contracts between its neighbors and an added wedge expands from the shared boundary. The wheel therefore remains continuous on every frame. Canvas/dense mode automatically falls back to a fast `crossfade` to avoid repainting hundreds of complex frames.

The sector image (`WheelItem.image`) is always rendered **above** its `color` and clipped to the sector wedge. Transparent PNG/GIF pixels therefore leave the sector color visible. The object form also accepts `opacity` and `fit`: `'cover' | 'contain' | 'stretch'`. `scale` (default `1`) scales the layer from the wheel center: values below `1` zoom out and values above `1` zoom in. `rotation` rotates the image around the center in degrees, while `offsetX` and `offsetY` move it horizontally and vertically in wheel coordinates from `0` to `100` (positive values move right and down).

## Current limitations

- Geometric `collapse` is intended for regular SVG wheels. Canvas and dense collections use `crossfade` to keep frame cost predictable.
- Hover and click are geometric; applications that need full keyboard navigation for hundreds of sectors should provide an external prize list.
- For valuable prizes, the server should remain the source of truth: client-side mode selects locally for UI-only experiences.
