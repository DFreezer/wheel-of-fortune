import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { createSectors, chooseWeightedSector, pointerAngleForPosition, positiveModulo, screenAngleToWheelAngle, sectorAtAngle, targetAngle, type Sector } from './geometry';
import { resolveCanvasCollapsePolicy } from './canvasTransitionPolicy';
import { secureRandom } from './random';
import { WheelCanvasRenderer, WheelCanvasTransitionRenderer } from './renderers';
import type {
  ItemsTransitionConfig,
  IdleAnimationConfig,
  SectorTextStyle,
  SpinAnimationConfig,
  SpinRequest,
  SpinResult,
  ServerWinner,
  WheelController,
  WheelDebugConfig,
  WheelItem,
  WheelProps,
  WheelSectorEvent,
  WheelState,
  WheelTheme,
  WheelThemeOptions,
  WheelSoundSource,
} from './types';
import './wheel.css';

const DEFAULT_TEXT: SectorTextStyle = {
  color: '#ffffff',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: 3.4,
  fontWeight: 700,
  radius: 0.66,
  innerRadius: 0,
  offsetX: 0,
  offsetY: 0,
  orientation: 'radial',
  align: 'middle',
  overflow: 'shrink-wrap',
  strokeColor: 'transparent',
  strokeWidth: 0,
  shadow: { color: 'transparent', blur: 0, offsetX: 0, offsetY: 0 },
};

const DEFAULT_THEME: WheelTheme = {
  background: '#111827',
  sector: { colors: ['#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb'] },
  text: DEFAULT_TEXT,
  border: { color: 'rgba(255, 255, 255, 0.72)', width: 0.7, shadow: { color: 'transparent', blur: 0, offsetX: 0, offsetY: 0 } },
  dividers: { color: '#000000', width: 0.45, shadow: { color: '#000000', blur: 1, offsetX: 0, offsetY: 0 } },
};

const DEFAULT_SPIN: SpinAnimationConfig = {
  duration: 4800,
  rotations: { min: 5, max: 7 },
  easing: 'cubic-bezier(0.12, 0.82, 0.18, 1)',
};

const DEFAULT_ITEMS_TRANSITION: ItemsTransitionConfig = {
  enabled: true,
  duration: 260,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  mode: 'crossfade',
};

const DEFAULT_IDLE_ANIMATION: IdleAnimationConfig = {
  enabled: false,
  duration: 2800,
  easing: 'ease-in-out',
  rotation: 0.65,
  scale: 1,
};

const DEFAULT_DEBUG: WheelDebugConfig = {
  enabled: false,
};

const ATTACH = '__wheelOfFortuneAttach';

interface WheelHost {
  spin(request?: SpinRequest): Promise<SpinResult>;
  cancel(reason?: string): void;
  getState(): WheelState;
}

interface InternalWheelController extends WheelController {
  [ATTACH]?: (host: WheelHost | null) => void;
}

interface ViewportBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  dimension: number;
}

function cssSize(size: string | number | undefined): string | undefined {
  return typeof size === 'number' ? `${size}px` : size;
}

function resolveTheme(theme?: WheelThemeOptions): WheelTheme {
  return {
    ...DEFAULT_THEME,
    ...theme,
    sector: { ...DEFAULT_THEME.sector, ...theme?.sector },
    text: { ...DEFAULT_THEME.text, ...theme?.text, shadow: { ...DEFAULT_THEME.text.shadow, ...theme?.text?.shadow } },
    border: { ...DEFAULT_THEME.border, ...theme?.border, shadow: { ...DEFAULT_THEME.border.shadow, ...theme?.border?.shadow } },
    dividers: { ...DEFAULT_THEME.dividers, ...theme?.dividers, shadow: { ...DEFAULT_THEME.dividers.shadow, ...theme?.dividers?.shadow } },
  };
}

function resolveIdleAnimation(config?: boolean | Partial<IdleAnimationConfig>): IdleAnimationConfig {
  if (config === true) return { ...DEFAULT_IDLE_ANIMATION, enabled: true };
  if (!config) return DEFAULT_IDLE_ANIMATION;
  return { ...DEFAULT_IDLE_ANIMATION, ...config };
}

function resolveSpinConfig(config?: Partial<SpinAnimationConfig>): SpinAnimationConfig {
  return { ...DEFAULT_SPIN, ...config };
}

function resolveItemsTransition(config?: boolean | Partial<ItemsTransitionConfig>): ItemsTransitionConfig {
  if (config === false) return { ...DEFAULT_ITEMS_TRANSITION, enabled: false, mode: 'none' };
  if (config === true || config === undefined) return DEFAULT_ITEMS_TRANSITION;
  return { ...DEFAULT_ITEMS_TRANSITION, ...config };
}

function resolveDebug(config?: boolean | Partial<WheelDebugConfig>): WheelDebugConfig {
  if (config === true) return { enabled: true };
  if (!config) return DEFAULT_DEBUG;
  return { ...DEFAULT_DEBUG, ...config };
}

function membershipChanged<T>(previous: readonly WheelItem<T>[], next: readonly WheelItem<T>[]): boolean {
  if (previous.length !== next.length) return true;
  const nextIds = new Set(next.map((item) => item.id));
  return previous.some((item) => !nextIds.has(item.id));
}

function currentTransformAngle(element: HTMLElement, fallback: number): number {
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === 'none') return fallback;
  const matrix3d = transform.match(/^matrix3d\((.+)\)$/)?.[1]?.split(',').map(Number);
  const values = matrix3d ?? transform.match(/^matrix\((.+)\)$/)?.[1]?.split(',').map(Number);
  if (!values || values.length < 2 || values.some((value) => !Number.isFinite(value))) return fallback;
  return (Math.atan2(values[1], values[0]) * 180) / Math.PI;
}

function randomRotations(rotations: SpinAnimationConfig['rotations']): number {
  if (typeof rotations === 'number') return Math.max(0, Math.round(rotations));
  const min = Math.max(0, Math.ceil(Math.min(rotations.min, rotations.max)));
  const max = Math.max(min, Math.floor(Math.max(rotations.min, rotations.max)));
  return min + Math.floor(secureRandom() * (max - min + 1));
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return reduced;
}

function DefaultPointer() {
  return <span className="wheel__defaultPointer" aria-hidden="true" />;
}

/**
 * Creates a stable controller that can be passed to a Wheel instance.
 * The controller is intentionally imperative only for commands (spin/cancel);
 * sector data remains a normal controlled React prop.
 */
export function useWheel(): WheelController {
  const controllerRef = useRef<InternalWheelController | null>(null);
  if (!controllerRef.current) {
    let host: WheelHost | null = null;
    const controller: InternalWheelController = {
      spin: <T,>(request?: SpinRequest) => {
        if (!host) return Promise.reject(new Error('Wheel controller is not attached to a mounted <Wheel>.')) as Promise<SpinResult<T>>;
        return host.spin(request) as Promise<SpinResult<T>>;
      },
      cancel: (reason?: string) => host?.cancel(reason),
      getState: () => host?.getState() ?? { status: 'idle', rotation: 0 },
      [ATTACH]: (nextHost) => {
        host = nextHost;
      },
    };
    controllerRef.current = controller;
  }
  return controllerRef.current;
}

export function Wheel<T = unknown>({
  items,
  controller,
  maxCanvasDpr = 2,
  itemsTransition,
  itemsChangeBehavior = 'defer',
  respectReducedMotion = true,
  size = '100%',
  minSize,
  maxSize,
  className,
  style,
  ariaLabel = 'Wheel of fortune',
  accessibleItemList = true,
  theme: partialTheme,
  pointer,
  pointerPosition = 'top',
  overlay,
  center,
  centerSize = '25%',
  sounds,
  spinAnimation,
  idleAnimation,
  minLabelAngle = 7,
  showProbability = false,
  debug,
  highlightedItemId,
  highlightStyle,
  onCanvasDraw,
  onSpinStart,
  onSectorPass,
  onSectorHover,
  onSectorClick,
  onSpinEnd,
  onSpinCancel,
  onItemsTransitionStart,
  onItemsTransitionEnd,
  onError,
}: WheelProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const idleRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRejectRef = useRef<((reason: Error) => void) | null>(null);
  const resolverAbortRef = useRef<AbortController | null>(null);
  const resolverTokenRef = useRef(0);
  const rotationRef = useRef(0);
  const visualRotationRef = useRef(0);
  const idleFrozenAngleRef = useRef(0);
  const statusRef = useRef<WheelState['status']>('idle');
  const lastTickRef = useRef(0);
  const lastPointerAnimationRef = useRef(0);
  const pointerBounceFrameRef = useRef<number | null>(null);
  const idlePointerSectorIdRef = useRef<string | null | undefined>(undefined);
  const hoveredItemIdRef = useRef<string | null>(null);
  const viewportBoundsRef = useRef<ViewportBounds | null>(null);
  const soundUrlsRef = useRef<Partial<Record<'spin' | 'tick' | 'win', string>>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Partial<Record<'spin' | 'tick' | 'win', AudioBuffer>>>({});
  const audioDecodeTokenRef = useRef(0);
  const latestPropsRef = useRef<WheelProps<T>>({ items } as WheelProps<T>);
  const latestItemsRef = useRef(items);
  const reducedMotion = usePrefersReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  const [displayItems, setDisplayItems] = useState(items);
  const displayItemsRef = useRef(items);
  const [itemsTransitionState, setItemsTransitionState] = useState<{
    from: readonly WheelItem<T>[];
    to: readonly WheelItem<T>[];
    id: number;
    config: ItemsTransitionConfig;
  } | null>(null);
  const [idleAnimationKey, setIdleAnimationKey] = useState(0);
  // Keep the resting rotor angle in React state as well as in the ref. The
  // idle wrapper is deliberately re-keyed after a spin to restart its CSS
  // animation; without a declarative angle that remount also drops the rotor's
  // imperative inline transform while hit-testing still uses rotationRef.
  const [committedRotation, setCommittedRotation] = useState(0);
  const itemsTransitionRef = useRef<typeof itemsTransitionState>(null);
  const itemsTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionIdRef = useRef(0);
  const [status, setStatus] = useState<WheelState['status']>('idle');
  const [announcement, setAnnouncement] = useState('');
  const themeKey = JSON.stringify(partialTheme ?? {});
  const theme = useMemo(() => resolveTheme(partialTheme), [themeKey]);
  const idleKey = JSON.stringify(idleAnimation ?? false);
  const resolvedIdleAnimation = useMemo(() => resolveIdleAnimation(idleAnimation), [idleKey]);
  const debugKey = JSON.stringify(debug ?? false);
  const resolvedDebug = useMemo(() => resolveDebug(debug), [debugKey]);
  const sectors = useMemo(() => createSectors(displayItems), [displayItems]);
  const sectorsRef = useRef(sectors);
  const canvasCollapsePolicy = itemsTransitionState?.config.mode === 'collapse'
    ? resolveCanvasCollapsePolicy(itemsTransitionState.from.length, itemsTransitionState.to.length)
    : null;

  latestPropsRef.current = {
    items,
    controller,
    maxCanvasDpr,
    itemsTransition,
    itemsChangeBehavior,
    respectReducedMotion,
    size,
    minSize,
    maxSize,
    className,
    style,
    ariaLabel,
    accessibleItemList,
    theme: partialTheme,
    pointer,
    pointerPosition,
    overlay,
    center,
    centerSize,
    sounds,
    spinAnimation,
    idleAnimation,
    minLabelAngle,
    showProbability,
    debug,
    highlightedItemId,
    highlightStyle,
    onCanvasDraw,
    onSpinStart,
    onSectorPass,
    onSectorHover,
    onSectorClick,
    onSpinEnd,
    onSpinCancel,
    onItemsTransitionStart,
    onItemsTransitionEnd,
    onError,
  };
  latestItemsRef.current = items;
  reducedMotionRef.current = reducedMotion;
  displayItemsRef.current = displayItems;
  itemsTransitionRef.current = itemsTransitionState;
  sectorsRef.current = sectors;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateBounds = () => {
      const rect = viewport.getBoundingClientRect();
      viewportBoundsRef.current = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        dimension: Math.min(rect.width, rect.height),
      };
    };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateBounds);
    observer?.observe(viewport);
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds, true);
    updateBounds();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds, true);
    };
  }, []);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const browserWindow = window as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContextConstructor();
    }
    return audioContextRef.current;
  }, []);

  useEffect(() => {
    const objectUrls: string[] = [];
    const resolveSource = (source: WheelSoundSource | undefined): string | undefined => {
      if (!source || typeof source === 'string') return source;
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined;
      const url = URL.createObjectURL(source);
      objectUrls.push(url);
      return url;
    };
    const urls = {
      spin: resolveSource(sounds?.spin),
      tick: resolveSource(sounds?.tick),
      win: resolveSource(sounds?.win),
    };
    soundUrlsRef.current = urls;
    audioBuffersRef.current = {};
    const decodeToken = ++audioDecodeTokenRef.current;
    const abort = new AbortController();
    const context = Object.values(urls).some(Boolean) ? getAudioContext() : null;

    const decode = async (kind: 'spin' | 'tick' | 'win', url: string | undefined) => {
      if (!context || !url) return;
      try {
        const response = await fetch(url, { signal: abort.signal });
        if (!response.ok) return;
        const source = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(source);
        if (!abort.signal.aborted && audioDecodeTokenRef.current === decodeToken) {
          audioBuffersRef.current[kind] = buffer;
        }
      } catch {
        // Sound is an optional enhancement. A CORS error or unsupported codec
        // must never affect spinning or the result callback.
      }
    };
    void decode('spin', urls.spin);
    void decode('tick', urls.tick);
    void decode('win', urls.win);

    return () => {
      abort.abort();
      audioDecodeTokenRef.current += 1;
      if (soundUrlsRef.current === urls) soundUrlsRef.current = {};
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [getAudioContext, sounds?.spin, sounds?.tick, sounds?.win]);

  useEffect(() => () => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    audioBuffersRef.current = {};
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  }, []);

  const playSound = useCallback((kind: 'spin' | 'tick' | 'win') => {
    const sound = latestPropsRef.current.sounds;
    const buffer = audioBuffersRef.current[kind];
    const context = getAudioContext();
    if (!sound?.enabled || !buffer || !context) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = Math.min(Math.max(sound.volume ?? 0.5, 0), 1);
    source.connect(gain).connect(context.destination);
    const start = () => {
      try {
        source.start();
      } catch {
        // A source can be started only once. Ignoring a late/duplicate start
        // preserves the visual tick without creating an HTMLAudioElement.
      }
    };
    if (context.state === 'suspended') void context.resume().then(start).catch(() => undefined);
    else start();
  }, [getAudioContext]);

  const animatePointer = useCallback(() => {
    const pointerElement = pointerRef.current;
    const now = performance.now();
    if (!pointerElement || now - lastPointerAnimationRef.current < 42) return;
    lastPointerAnimationRef.current = now;
    if (pointerBounceFrameRef.current !== null) cancelAnimationFrame(pointerBounceFrameRef.current);
    pointerElement.classList.remove('wheel__pointerContent--tick');
    pointerBounceFrameRef.current = requestAnimationFrame(() => {
      pointerElement.classList.add('wheel__pointerContent--tick');
      pointerBounceFrameRef.current = null;
    });
  }, []);

  const notifySectorPass = useCallback((sector: Sector<T>, playTickSound = true) => {
    animatePointer();
    latestPropsRef.current.onSectorPass?.(sector.item);
    if (!playTickSound) return;
    const rateLimit = latestPropsRef.current.sounds?.tickRateLimit ?? 55;
    if (performance.now() - lastTickRef.current >= rateLimit) {
      lastTickRef.current = performance.now();
      playSound('tick');
    }
  }, [animatePointer, playSound]);

  const pointerAngle = pointerAngleForPosition(pointerPosition);
  const idleAnimationIsActive = resolvedIdleAnimation.enabled && !(respectReducedMotion && reducedMotion);

  // CSS keeps idle motion on the compositor. This small observer only reacts
  // when the pointer crosses a sector boundary, so it does not trigger React
  // renders for every animation frame.
  useEffect(() => {
    idlePointerSectorIdRef.current = undefined;
    if (!onSectorPass || !idleAnimationIsActive || status !== 'idle' || !sectors.length) return;

    let frame = 0;
    const observe = () => {
      const idleRotation = idleRef.current ? currentTransformAngle(idleRef.current, 0) : 0;
      const sector = sectorAtAngle(sectorsRef.current, pointerAngle - idleRotation - rotationRef.current);
      const nextId = sector?.item.id ?? null;
      const previousId = idlePointerSectorIdRef.current;
      if (previousId !== undefined && sector && nextId !== previousId) notifySectorPass(sector, false);
      idlePointerSectorIdRef.current = nextId;
      frame = requestAnimationFrame(observe);
    };
    frame = requestAnimationFrame(observe);
    return () => cancelAnimationFrame(frame);
  }, [idleAnimationIsActive, notifySectorPass, onSectorPass, pointerAngle, sectors, status]);

  const finishItemsTransition = useCallback((notify = true) => {
    if (itemsTransitionTimerRef.current !== null) {
      clearTimeout(itemsTransitionTimerRef.current);
      itemsTransitionTimerRef.current = null;
    }
    if (!itemsTransitionRef.current) return;
    itemsTransitionRef.current = null;
    setItemsTransitionState(null);
    if (notify) latestPropsRef.current.onItemsTransitionEnd?.();
  }, []);

  const applyItems = useCallback((nextItems: readonly WheelItem<T>[]) => {
    const previousItems = displayItemsRef.current;
    const config = resolveItemsTransition(latestPropsRef.current.itemsTransition);
    finishItemsTransition(false);
    setDisplayItems(nextItems);

    if (!previousItems.length || !membershipChanged(previousItems, nextItems) || !config.enabled || config.mode === 'none') return;
    const duration = reducedMotionRef.current ? 1 : config.duration;
    const transition = { from: previousItems, to: nextItems, id: ++transitionIdRef.current, config: { ...config, duration } };
    itemsTransitionRef.current = transition;
    setItemsTransitionState(transition);
    latestPropsRef.current.onItemsTransitionStart?.();
    itemsTransitionTimerRef.current = setTimeout(() => finishItemsTransition(), duration);
  }, [finishItemsTransition]);

  const cancel = useCallback((reason = 'Spin cancelled') => {
    const resolverAbort = resolverAbortRef.current;
    const animation = animationRef.current;
    if (!animation && !resolverAbort) return;
    if (resolverAbort) {
      resolverAbortRef.current = null;
      resolverTokenRef.current += 1;
      resolverAbort.abort();
      statusRef.current = 'idle';
      setStatus('idle');
      setAnnouncement('Result request cancelled');
      applyItems(latestItemsRef.current);
      latestPropsRef.current.onSpinCancel?.(reason);
      pendingRejectRef.current?.(new Error(reason));
      pendingRejectRef.current = null;
      return;
    }
    if (!animation) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const current = rotorRef.current ? currentTransformAngle(rotorRef.current, rotationRef.current) : rotationRef.current;
    const visualRotation = current + idleFrozenAngleRef.current;
    rotationRef.current = visualRotation;
    visualRotationRef.current = visualRotation;
    setCommittedRotation(visualRotation);
    if (rotorRef.current) rotorRef.current.style.transform = `rotate(${visualRotation}deg)`;
    idleFrozenAngleRef.current = 0;
    setIdleAnimationKey((key) => key + 1);
    animationRef.current = null;
    animation.cancel();
    statusRef.current = 'idle';
    setStatus('idle');
    setAnnouncement('Spin cancelled');
    applyItems(latestItemsRef.current);
    latestPropsRef.current.onSpinCancel?.(reason);
    pendingRejectRef.current?.(new Error(reason));
    pendingRejectRef.current = null;
  }, [applyItems]);

  useEffect(() => {
    if (statusRef.current !== 'idle') {
      if (latestPropsRef.current.itemsChangeBehavior === 'cancel-spin') cancel('Items changed during spin');
      return;
    }
    applyItems(items);
  }, [applyItems, cancel, items]);

  const startSpin = useCallback((request: SpinRequest = { mode: 'client' }): Promise<SpinResult<T>> => {
    try {
      if (statusRef.current !== 'idle') throw new Error('A spin is already in progress.');
      const snapshot = sectorsRef.current;
      if (!snapshot.length) throw new Error('Cannot spin a wheel without enabled items with a positive weight.');

      const mode = request.mode === 'server' ? 'server' : 'client';
      const winner = request.mode === 'server'
        ? snapshot.find((sector) => sector.item.id === request.winnerId)
        : chooseWeightedSector(snapshot, secureRandom());
      if (!winner) {
        const requestedWinnerId = request.mode === 'server' ? request.winnerId : '';
        throw new Error(`Server winner "${requestedWinnerId}" is absent or is not eligible.`);
      }

      const landing = request.landing?.mode ?? 'center';
      const edgePadding = request.landing?.edgePadding ?? 0.14;
      const hitAngle = targetAngle(winner, landing, edgePadding, secureRandom());
      const requestedConfig = resolveSpinConfig({ ...latestPropsRef.current.spinAnimation, ...request.animation });
      const config = respectReducedMotion && reducedMotion
        ? { ...requestedConfig, duration: 1, rotations: 0, easing: 'linear' }
        : requestedConfig;
      const rotations = randomRotations(config.rotations);
      const idleRotation = idleRef.current ? currentTransformAngle(idleRef.current, 0) : 0;
      idleFrozenAngleRef.current = idleRotation;
      const normalizedTarget = pointerAngle - hitAngle;
      const delta = positiveModulo(normalizedTarget - idleRotation - rotationRef.current, 360);
      const endRotation = rotationRef.current + rotations * 360 + delta;
      const startRotation = rotationRef.current;
      visualRotationRef.current = idleRotation + startRotation;
      const rotor = rotorRef.current;
      if (!rotor || typeof rotor.animate !== 'function') throw new Error('Web Animations API is not available in this browser.');

      finishItemsTransition(false);
      statusRef.current = 'spinning';
      setStatus('spinning');
      setAnnouncement('Wheel is spinning');
      latestPropsRef.current.onSpinStart?.();
      playSound('spin');
      let lastSectorId = sectorAtAngle(snapshot, pointerAngle - idleRotation - startRotation)?.item.id;
      const animation = rotor.animate(
        [{ transform: `rotate(${startRotation}deg)` }, { transform: `rotate(${endRotation}deg)` }],
        { duration: config.duration, easing: config.easing, fill: 'forwards' },
      );
      animationRef.current = animation;

      const tick = () => {
        if (animationRef.current !== animation) return;
        const progress = animation.effect?.getComputedTiming().progress;
        if (typeof progress === 'number') {
          const angle = startRotation + (endRotation - startRotation) * progress;
          visualRotationRef.current = idleRotation + angle;
          const currentSector = sectorAtAngle(snapshot, pointerAngle - idleRotation - angle);
          if (currentSector && currentSector.item.id !== lastSectorId) {
            lastSectorId = currentSector.item.id;
            notifySectorPass(currentSector);
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      if (latestPropsRef.current.onSectorPass) rafRef.current = requestAnimationFrame(tick);

      return new Promise<SpinResult<T>>((resolve, reject) => {
        pendingRejectRef.current = reject;
        void animation.finished.then(() => {
          if (animationRef.current !== animation) return;
          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
          const finalRotation = endRotation + idleFrozenAngleRef.current;
          rotor.style.transform = `rotate(${finalRotation}deg)`;
          rotationRef.current = finalRotation;
          visualRotationRef.current = finalRotation;
          setCommittedRotation(finalRotation);
          idleFrozenAngleRef.current = 0;
          // A finished WAAPI animation with fill: forwards otherwise keeps
          // winning over the inline transform. Clear it before hit-testing.
          animation.cancel();
          setIdleAnimationKey((key) => key + 1);
          animationRef.current = null;
          pendingRejectRef.current = null;
          statusRef.current = 'idle';
          setStatus('idle');
          applyItems(latestItemsRef.current);
          const result: SpinResult<T> = { winner: winner.item, winnerId: winner.item.id, rotation: endRotation, mode };
          setAnnouncement(`Winner: ${winner.item.label}`);
          playSound('win');
          latestPropsRef.current.onSpinEnd?.(result);
          resolve(result);
        }).catch(() => undefined);
      });
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      latestPropsRef.current.onError?.(error);
      return Promise.reject(error);
    }
  }, [applyItems, finishItemsTransition, notifySectorPass, pointerAngle, reducedMotion, respectReducedMotion]);

  const spin = useCallback((request: SpinRequest = { mode: 'client' }): Promise<SpinResult<T>> => {
    if (request.mode !== 'server' || !request.resolveWinner) return startSpin(request);

    try {
      if (statusRef.current !== 'idle') throw new Error('A spin is already in progress.');
      const resolver = request.resolveWinner;
      const abort = new AbortController();
      const token = ++resolverTokenRef.current;
      resolverAbortRef.current = abort;
      statusRef.current = 'resolving';
      setStatus('resolving');
      setAnnouncement('Resolving result from the server');

      return new Promise<SpinResult<T>>((resolve, reject) => {
        pendingRejectRef.current = reject;
        void Promise.resolve()
          .then(() => resolver({ signal: abort.signal }))
          .then((resolved) => {
            if (abort.signal.aborted || resolverTokenRef.current !== token) return;
            const outcome: ServerWinner = typeof resolved === 'string' ? { winnerId: resolved } : resolved;
            if (!outcome?.winnerId) throw new Error('Server resolver returned no winnerId.');

            resolverAbortRef.current = null;
            pendingRejectRef.current = null;
            statusRef.current = 'idle';
            setStatus('idle');
            const nextRequest: SpinRequest = {
              mode: 'server',
              winnerId: outcome.winnerId,
              landing: outcome.landing ?? request.landing,
              animation: { ...request.animation, ...outcome.animation },
            };
            return startSpin(nextRequest).then(resolve, (error) => {
              applyItems(latestItemsRef.current);
              reject(error);
            });
          })
          .catch((cause) => {
            if (abort.signal.aborted || resolverTokenRef.current !== token) return;
            resolverAbortRef.current = null;
            pendingRejectRef.current = null;
            statusRef.current = 'idle';
            setStatus('idle');
            setAnnouncement('Could not resolve a result');
            applyItems(latestItemsRef.current);
            const error = cause instanceof Error ? cause : new Error(String(cause));
            latestPropsRef.current.onError?.(error);
            reject(error);
          });
      });
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      latestPropsRef.current.onError?.(error);
      return Promise.reject(error);
    }
  }, [applyItems, startSpin]);

  const sectorAtPointer = useCallback((clientX: number, clientY: number): WheelSectorEvent<T> | null => {
    const bounds = viewportBoundsRef.current;
    if (!bounds) return null;
    const { dimension } = bounds;
    const x = clientX - (bounds.left + bounds.width / 2);
    const y = clientY - (bounds.top + bounds.height / 2);
    if (!dimension || x * x + y * y > (dimension / 2) ** 2) return null;

    const screenAngle = (Math.atan2(y, x) * 180) / Math.PI;
    const visualRotation = statusRef.current === 'spinning'
      ? visualRotationRef.current
      : (rotorRef.current ? currentTransformAngle(rotorRef.current, rotationRef.current) : rotationRef.current)
        + (idleRef.current ? currentTransformAngle(idleRef.current, 0) : 0);
    const angle = screenAngleToWheelAngle(screenAngle, visualRotation);
    const sector = sectorAtAngle(sectorsRef.current, angle);
    return sector ? { item: sector.item, index: sector.index, angle } : null;
  }, []);

  const reportHover = useCallback((sector: WheelSectorEvent<T> | null) => {
    const nextId = sector?.item.id ?? null;
    if (hoveredItemIdRef.current === nextId) return;
    hoveredItemIdRef.current = nextId;
    latestPropsRef.current.onSectorHover?.(sector);
  }, []);

  const interactive = Boolean(onSectorHover || onSectorClick);
  const handlePointerMove = onSectorHover
    ? (event: PointerEvent<HTMLDivElement>) => reportHover(sectorAtPointer(event.clientX, event.clientY))
    : undefined;
  const handlePointerLeave = onSectorHover ? () => reportHover(null) : undefined;
  const handleSectorClick = onSectorClick
    ? (event: MouseEvent<HTMLDivElement>) => {
        const sector = sectorAtPointer(event.clientX, event.clientY);
        if (sector) latestPropsRef.current.onSectorClick?.(sector);
      }
    : undefined;

  const host = useMemo<WheelHost>(() => ({
    spin: spin as WheelHost['spin'],
    cancel,
    getState: () => ({ status: statusRef.current, rotation: rotationRef.current }),
  }), [cancel, spin]);

  useLayoutEffect(() => {
    const internal = controller as InternalWheelController | undefined;
    internal?.[ATTACH]?.(host);
    return () => internal?.[ATTACH]?.(null);
  }, [controller, host]);

  useEffect(() => () => {
    if (pointerBounceFrameRef.current !== null) cancelAnimationFrame(pointerBounceFrameRef.current);
    cancel('Wheel unmounted');
    finishItemsTransition(false);
  }, [cancel, finishItemsTransition]);

  const wheelStyle: CSSProperties = {
    width: cssSize(size),
    minWidth: cssSize(minSize),
    maxWidth: cssSize(maxSize),
    ...style,
  };

  const idleStyle = {
    '--wheel-idle-duration': `${Math.max(1, resolvedIdleAnimation.duration)}ms`,
    '--wheel-idle-easing': resolvedIdleAnimation.easing,
    '--wheel-idle-angle': `${resolvedIdleAnimation.rotation}deg`,
    '--wheel-idle-scale': String(Math.max(0.1, resolvedIdleAnimation.scale)),
  } as CSSProperties;

  const renderSectors = (
    drawingSectors: readonly Sector<T>[],
    key: string,
    drawingClassName?: string,
    drawingStyle?: CSSProperties,
    decorations = true,
  ) => {
    const rendererProps = {
      sectors: drawingSectors,
      theme,
      minLabelAngle,
      showProbability,
      debug: resolvedDebug,
      highlightedItemId,
      highlightStyle,
      onCanvasDraw,
      decorations,
      className: drawingClassName,
      style: drawingStyle,
    };
    return <WheelCanvasRenderer key={key} {...rendererProps} maxCanvasDpr={maxCanvasDpr} />;
  };

  const renderDrawing = (drawingItems: readonly WheelItem<T>[], key: string, drawingClassName?: string, drawingStyle?: CSSProperties) => {
    const drawingSectors = drawingItems === displayItems ? sectors : createSectors(drawingItems);
    return renderSectors(drawingSectors, key, drawingClassName, drawingStyle);
  };

  const transitionStyle = itemsTransitionState
    ? { animationDuration: `${itemsTransitionState.config.duration}ms`, animationTimingFunction: itemsTransitionState.config.easing }
    : undefined;
  // Keep the current drawing mounted while a transition layer prepares its
  // first frame. A Canvas is transparent until it is painted, so this avoids
  // briefly replacing the wheel with the renderer's CSS background.
  const transitionLayerStyle: CSSProperties | undefined = itemsTransitionState
    ? { ...transitionStyle, backgroundColor: 'transparent' }
    : undefined;
  return (
    <div className={['wheel', interactive && 'wheel--interactive', className].filter(Boolean).join(' ')} style={wheelStyle} aria-busy={status !== 'idle'}>
      <div
        ref={viewportRef}
        className="wheel__viewport"
        role={interactive ? 'group' : 'img'}
        aria-label={ariaLabel}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleSectorClick}
      >
        <div
          key={idleAnimationKey}
          ref={idleRef}
          className={['wheel__idle', idleAnimationIsActive && 'wheel__idle--active', status === 'spinning' && 'wheel__idle--paused'].filter(Boolean).join(' ')}
          style={idleStyle}
        >
        <div className="wheel__rotor" ref={rotorRef} style={{ transform: `rotate(${committedRotation}deg)` }}>
          {itemsTransitionState ? <>
            {renderDrawing(itemsTransitionState.from, 'current', 'wheel__drawing')}
            {itemsTransitionState.config.mode === 'collapse' && canvasCollapsePolicy && canvasCollapsePolicy !== 'crossfade'
              ? <WheelCanvasTransitionRenderer
                  key={`transition-canvas-${itemsTransitionState.id}`}
                  from={createSectors(itemsTransitionState.from)}
                  to={createSectors(itemsTransitionState.to)}
                  theme={theme}
                  minLabelAngle={minLabelAngle}
                  showProbability={showProbability}
                  debug={resolvedDebug}
                  duration={itemsTransitionState.config.duration}
                  easing={itemsTransitionState.config.easing}
                  detail={canvasCollapsePolicy === 'full' ? 'full' : 'transition'}
                  className="wheel__drawing"
                  style={transitionLayerStyle}
                  maxCanvasDpr={maxCanvasDpr}
                  onCanvasDraw={onCanvasDraw}
                />
              : <>
                  {renderDrawing(itemsTransitionState.from, `transition-from-${itemsTransitionState.id}`, 'wheel__drawing wheel__drawing--fadeOut', transitionLayerStyle)}
                  {renderDrawing(itemsTransitionState.to, `transition-to-${itemsTransitionState.id}`, 'wheel__drawing wheel__drawing--fadeIn', transitionLayerStyle)}
                </>}
          </> : renderDrawing(displayItems, 'current', 'wheel__drawing')}
        </div>
        </div>
        {overlay && <div className="wheel__overlay">{overlay}</div>}
        {center && <div className="wheel__center" style={{ width: cssSize(centerSize) }}>{center}</div>}
        <div className={['wheel__pointer', `wheel__pointer--${pointerPosition}`].join(' ')}>
          <div className="wheel__pointerContent" ref={pointerRef}>{pointer ?? <DefaultPointer />}</div>
        </div>
      </div>
      {accessibleItemList && <ul className="wheel__srOnly" aria-label={`${ariaLabel} sectors`}>
        {displayItems.map((item) => <li key={item.id} aria-disabled={item.disabled || item.weight <= 0}>{item.label}{item.weight > 0 ? ` (${item.weight})` : ''}</li>)}
      </ul>}
      <span className="wheel__srOnly" aria-live="polite">{announcement}</span>
    </div>
  );
}
