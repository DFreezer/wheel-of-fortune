import { Profiler, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Wheel, useWheel, type ItemsTransitionConfig, type WheelCanvasDrawEvent, type WheelItem } from './lib';
import './benchmark.css';

const fixtureCounts = [6, 50, 100, 300, 1000] as const;
const palette = ['#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb'];
const tickSound = new URL('./assets/realistic-space/beep.mp3', import.meta.url).href;

type Scenario = 'idle' | 'spin-quiet' | 'spin-ticks' | 'hover-spin' | 'crossfade' | 'collapse';

interface BenchmarkResult {
  fps: number;
  p95FrameMs: number;
  longTasks: number;
  reactCommits: number;
  canvasDraws: number;
  domNodes: number;
  heapDelta?: number;
}

function fixture(count: number, prefix = 'fixture'): WheelItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    label: `Prize ${index + 1}`,
    weight: 1 + ((index * 7) % 5),
    color: palette[index % palette.length],
  }));
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function wait(duration: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function percentile(values: readonly number[], percentileValue: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1))];
}

function BenchmarkApp() {
  const controller = useWheel();
  const hostRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState<(typeof fixtureCounts)[number]>(100);
  const [scenario, setScenario] = useState<Scenario>('spin-quiet');
  const [items, setItems] = useState<WheelItem[]>(() => fixture(100));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const drawCountRef = useRef(0);
  const commitCountRef = useRef(0);
  const canvasDraw = useCallback((_event: WheelCanvasDrawEvent) => { drawCountRef.current += 1; }, []);
  const sectorPass = useCallback(() => undefined, []);
  const hover = useCallback(() => undefined, []);

  useEffect(() => {
    setItems(fixture(count));
    setResult(null);
  }, [count]);

  const itemsTransition = useMemo<false | ItemsTransitionConfig>(() => {
    if (scenario === 'crossfade') return { enabled: true, mode: 'crossfade', duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' };
    if (scenario === 'collapse') return { enabled: true, mode: 'collapse', duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' };
    return false;
  }, [scenario]);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    drawCountRef.current = 0;
    commitCountRef.current = 0;
    const frameTimes: number[] = [];
    let lastFrame = performance.now();
    let frame = 0;
    const sample = (now: number) => {
      frameTimes.push(now - lastFrame);
      lastFrame = now;
      frame = requestAnimationFrame(sample);
    };
    const longTasks: PerformanceEntry[] = [];
    const observer = typeof PerformanceObserver === 'undefined' ? undefined : new PerformanceObserver((entries) => longTasks.push(...entries.getEntries()));
    try {
      observer?.observe({ type: 'longtask', buffered: true });
    } catch {
      // Long Task API is optional (for example, unavailable in Firefox).
    }
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    const startHeap = memory.memory?.usedJSHeapSize;
    frame = requestAnimationFrame(sample);

    try {
      await nextFrame();
      if (scenario === 'idle') await wait(1800);
      if (scenario === 'spin-quiet' || scenario === 'spin-ticks' || scenario === 'hover-spin') {
        const hoverTimer = scenario === 'hover-spin' ? window.setInterval(() => {
          const viewport = hostRef.current?.querySelector<HTMLElement>('.wheel__viewport');
          if (!viewport) return;
          const rect = viewport.getBoundingClientRect();
          const angle = performance.now() / 180;
          viewport.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true,
            clientX: rect.left + rect.width / 2 + Math.cos(angle) * rect.width * .27,
            clientY: rect.top + rect.height / 2 + Math.sin(angle) * rect.height * .27,
          }));
        }, 60) : undefined;
        try {
          await controller.spin({ mode: 'client', animation: { duration: 1800, rotations: 3, easing: 'cubic-bezier(.12, .82, .18, 1)' } });
        } finally {
          if (hoverTimer !== undefined) window.clearInterval(hoverTimer);
        }
      }
      if (scenario === 'crossfade' || scenario === 'collapse') {
        setItems(fixture(count, `run-${Date.now()}`));
        await wait(520);
      }
    } finally {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      const usefulFrames = frameTimes.filter((duration) => duration > 0 && duration < 250);
      const average = usefulFrames.reduce((sum, duration) => sum + duration, 0) / Math.max(1, usefulFrames.length);
      setResult({
        fps: average ? 1000 / average : 0,
        p95FrameMs: percentile(usefulFrames, 0.95),
        longTasks: longTasks.filter((entry) => entry.duration > 50).length,
        reactCommits: commitCountRef.current,
        canvasDraws: drawCountRef.current,
        domNodes: hostRef.current?.querySelectorAll('*').length ?? 0,
        heapDelta: startHeap === undefined || memory.memory?.usedJSHeapSize === undefined ? undefined : memory.memory.usedJSHeapSize - startHeap,
      });
      setRunning(false);
    }
  }, [controller, count, running, scenario]);

  const trackCommit = useCallback(() => { commitCountRef.current += 1; }, []);
  const enablePasses = scenario === 'spin-ticks' || scenario === 'hover-spin';

  return <main className="benchmark">
    <header>
      <p>Wheel Canvas benchmark</p>
      <h1>Reproducible rendering measurements</h1>
      <a href="/">Return to playground</a>
    </header>
    <section className="benchmark__controls" aria-label="Benchmark controls">
      <label>Items<select value={count} onChange={(event) => setCount(Number(event.target.value) as (typeof fixtureCounts)[number])}>{fixtureCounts.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Scenario<select value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)}><option value="idle">Idle</option><option value="spin-quiet">Spin, no sound / pointer</option><option value="spin-ticks">Spin, sound / pointer</option><option value="hover-spin">Hover during spin</option><option value="crossfade">Crossfade</option><option value="collapse">Collapse</option></select></label>
      <button disabled={running} onClick={() => void run()}>{running ? 'Measuring…' : 'Run measurement'}</button>
    </section>
    <section className="benchmark__content">
      <div className="benchmark__wheel" ref={hostRef}>
        <Profiler id="wheel" onRender={trackCommit}>
          <Wheel
            items={items}
            controller={controller}
            size="min(72vw, 620px)"
            itemsTransition={itemsTransition}
            minLabelAngle={8}
            accessibleItemList={false}
            onCanvasDraw={canvasDraw}
            onSectorPass={enablePasses ? sectorPass : undefined}
            onSectorHover={scenario === 'hover-spin' ? hover : undefined}
            sounds={scenario === 'spin-ticks' ? { enabled: true, tick: tickSound, volume: 0.2 } : undefined}
          />
        </Profiler>
      </div>
      <dl className="benchmark__metrics">
        <div><dt>FPS</dt><dd>{result ? result.fps.toFixed(1) : '—'}</dd></div>
        <div><dt>p95 frame</dt><dd>{result ? `${result.p95FrameMs.toFixed(2)} ms` : '—'}</dd></div>
        <div><dt>Long tasks (&gt;50 ms)</dt><dd>{result?.longTasks ?? '—'}</dd></div>
        <div><dt>React commits</dt><dd>{result?.reactCommits ?? '—'}</dd></div>
        <div><dt>Canvas draws</dt><dd>{result?.canvasDraws ?? '—'}</dd></div>
        <div><dt>Wheel DOM nodes</dt><dd>{result?.domNodes ?? '—'}</dd></div>
        <div><dt>JS heap delta</dt><dd>{result?.heapDelta === undefined ? 'n/a' : `${Math.round(result.heapDelta / 1024)} KiB`}</dd></div>
      </dl>
    </section>
  </main>;
}

interface BenchmarkRootElement extends HTMLElement {
  __wheelOfFortuneBenchmarkRoot?: ReturnType<typeof createRoot>;
}

const rootElement = document.getElementById('root')! as BenchmarkRootElement;
const root = rootElement.__wheelOfFortuneBenchmarkRoot ?? (rootElement.__wheelOfFortuneBenchmarkRoot = createRoot(rootElement));
root.render(<BenchmarkApp />);
