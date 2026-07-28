# Canvas benchmark

Run the playground development server, then open [`/benchmark.html`](http://127.0.0.1:5173/benchmark.html). The page deliberately excludes the editor and decorative React slots, and uses fixed 6, 50, 100, 300, and 1000-sector fixtures.

For each supported scenario it reports FPS, p95 frame time, long tasks above 50 ms, React commits under the wheel profiler, Canvas draw submissions, wheel DOM node count, and JS heap delta where the browser exposes `performance.memory`. The hover scenario dispatches pointer moves around the wheel while it spins.

Record the browser version, DPR, viewport, and device in any comparison. The page is intended to compare revisions on the same device; it does not claim a universal FPS baseline.

Expected invariants:

- `spin-quiet` emits no Canvas draw after its initial setup and has no sector-pass observer;
- Canvas idle wheels use one drawing canvas, with an additional transparent canvas only while a highlight is visible;
- 1–50 sector collapse uses full drawing, 51–150 uses the 30 FPS simplified drawing, and 151+ uses crossfade;

## Captured local baseline

The following smoke baseline was captured on 2026-07-28 in the Codex in-app browser at its default viewport. It is a regression reference for that environment, not a cross-device performance promise. Scenario: 100 items, `spin-quiet`, 1.8 s spin, semantic list disabled by the benchmark page so it measures only the wheel drawing tree.

| Renderer | FPS | p95 frame | Long tasks | React commits | Canvas draws during spin | Wheel DOM nodes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Canvas | 238.9 | 4.50 ms | 0 | 2 | 0 | 9 |

The Canvas draw count is expected to stay zero during ordinary spin because the rotor is the only animated compositor layer.
