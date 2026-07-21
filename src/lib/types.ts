import type { CSSProperties, ReactNode } from 'react';

export type TextOrientation = 'radial' | 'tangential' | 'horizontal';
export type TextAlign = 'start' | 'middle' | 'end';
export type TextOverflow = 'hide' | 'ellipsis' | 'shrink';
/** Edge of the wheel on which the winning pointer is rendered. */
export type WheelPointerPosition = 'top' | 'right';

export interface TextShadowStyle {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface SectorTextStyle {
  color: string;
  fontFamily: string;
  fontSize: number | string;
  fontWeight: number | string;
  /** Position from the wheel centre: 0 is the centre, 1 is its outer edge. */
  radius: number;
  offsetX: number;
  offsetY: number;
  orientation: TextOrientation;
  align: TextAlign;
  maxWidth?: number;
  overflow: TextOverflow;
  /** Outline drawn around glyphs. Width uses the wheel's 0–100 viewBox units. */
  strokeColor: string;
  strokeWidth: number;
  shadow: TextShadowStyle;
}

/** Artwork drawn above a sector's colour, so transparent pixels preserve it. */
export interface WheelSectorImage {
  src: string;
  /** Opacity from 0 to 1. Default: 1. */
  opacity?: number;
  /** How the artwork fills the circular wheel before it is clipped to the sector. */
  fit?: 'cover' | 'contain' | 'stretch';
  /**
   * Scale around the wheel centre. Values below 1 zoom out and values above
   * 1 zoom in. Default: 1.
   */
  scale?: number;
  /** Rotation around the wheel centre, in degrees. Default: 0. */
  rotation?: number;
  /**
   * Horizontal offset in the wheel's 0–100 coordinate system. Positive values
   * move the image to the right. Default: 0.
   */
  offsetX?: number;
  /**
   * Vertical offset in the wheel's 0–100 coordinate system. Positive values
   * move the image down. Default: 0.
   */
  offsetY?: number;
}

export interface WheelItem<T = unknown> {
  id: string;
  label: string;
  /** Relative probability/size. The component normalizes the total to 360°. */
  weight: number;
  data?: T;
  color?: string;
  /** Image layer clipped to this sector and drawn above its colour. */
  image?: string | WheelSectorImage;
  text?: Partial<SectorTextStyle>;
  disabled?: boolean;
}

export interface ShadowStyle {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface StrokeStyle {
  color: string;
  width: number;
  shadow: ShadowStyle;
}

export interface StrokeStyleOptions {
  color?: string;
  width?: number;
  shadow?: Partial<ShadowStyle>;
}

export interface WheelTheme {
  background: string;
  sector: { colors: string[] };
  text: SectorTextStyle;
  border: StrokeStyle;
  dividers: StrokeStyle;
}

/** A deep partial theme intended for component props. */
export interface WheelThemeOptions {
  background?: string;
  sector?: Partial<WheelTheme['sector']>;
  text?: Partial<SectorTextStyle>;
  border?: StrokeStyleOptions;
  dividers?: StrokeStyleOptions;
}

export interface LandingConfig {
  mode?: 'center' | 'random';
  /** Reserved fraction at each sector edge in random mode, from 0 to < 0.5. */
  edgePadding?: number;
}

export interface SpinAnimationConfig {
  duration: number;
  /** Number of complete rotations before the target sector. */
  rotations: number | { min: number; max: number };
  easing: string;
}

/**
 * A subtle transform used only while the wheel is not spinning. It runs on a
 * parent compositor layer, so it never changes the sector geometry or winner.
 */
export interface IdleAnimationConfig {
  enabled: boolean;
  duration: number;
  easing: string;
  /** Maximum rotation to either side, in degrees. */
  rotation: number;
  /** Scale at the middle of the cycle. 1 means no pulse. */
  scale: number;
}

/** Value returned by an asynchronous server-side winner resolver. */
export interface ServerWinner {
  winnerId: string;
  /** The server may choose a different legal landing position for this result. */
  landing?: LandingConfig;
  /** The server may override the visual spin curve for this result. */
  animation?: Partial<SpinAnimationConfig>;
}

export interface ServerWinnerResolverContext {
  /** Aborted when `controller.cancel()` is called or the wheel unmounts. */
  signal: AbortSignal;
}

/**
 * Fetches an already-authoritative result. The function may return a string
 * for the simple case, or an object with per-result landing/animation options.
 */
export type ServerWinnerResolver = (
  context: ServerWinnerResolverContext,
) => Promise<string | ServerWinner> | string | ServerWinner;

/**
 * A remote/data URL or a locally selected audio file. Blob also covers File,
 * allowing a sound to be picked directly from an <input type="file">.
 */
export type WheelSoundSource = string | Blob;

export interface WheelSoundConfig {
  enabled?: boolean;
  /** One-shot sound played when a spin begins. */
  spin?: WheelSoundSource;
  tick?: WheelSoundSource;
  win?: WheelSoundSource;
  volume?: number;
  /** Minimum time in ms between tick sounds. */
  tickRateLimit?: number;
}

export type WheelRenderer = 'svg' | 'canvas' | 'auto';

/**
 * Transition used when the controlled `items` list gains or loses sectors.
 * Crossfade is deliberately the default: it remains smooth for a large wheel
 * without creating hundreds of animated SVG paths.
 */
export interface ItemsTransitionConfig {
  enabled: boolean;
  duration: number;
  easing: string;
  /**
   * `collapse` keeps the fast crossfade for the geometry that moved, while
   * newly added and removed sectors respectively expand from / collapse into
   * the wheel centre. It is intentionally CSS-only, so it stays safe for
   * Canvas and large lists too.
   */
  mode: 'crossfade' | 'collapse' | 'none';
}

export type SpinRequest =
  | {
      mode?: 'client';
      landing?: LandingConfig;
      animation?: Partial<SpinAnimationConfig>;
    }
  | {
      mode: 'server';
      /** An immediately available winner from the server. */
      winnerId?: string;
      /** A lazy server request. While it resolves the wheel is in `resolving` state. */
      resolveWinner?: ServerWinnerResolver;
      landing?: LandingConfig;
      animation?: Partial<SpinAnimationConfig>;
    };

export interface SpinResult<T = unknown> {
  winner: WheelItem<T>;
  winnerId: string;
  rotation: number;
  mode: 'client' | 'server';
}

export type WheelStatus = 'idle' | 'resolving' | 'spinning';

export interface WheelState {
  status: WheelStatus;
  rotation: number;
}

export interface WheelController {
  spin<T = unknown>(request?: SpinRequest): Promise<SpinResult<T>>;
  cancel(reason?: string): void;
  getState(): WheelState;
}

/** A sector identified by pointer interaction in either renderer. */
export interface WheelSectorEvent<T = unknown> {
  item: WheelItem<T>;
  index: number;
  /** Position inside the unrotated wheel, in degrees. */
  angle: number;
}

export interface WheelProps<T = unknown> {
  items: readonly WheelItem<T>[];
  controller?: WheelController;
  /** `auto` uses SVG for ordinary wheels and Canvas for dense ones. */
  renderer?: WheelRenderer;
  /** Item count at which `renderer="auto"` switches to Canvas. */
  canvasThreshold?: number;
  /** Upper bound for Canvas DPR. Prevents an unnecessarily large bitmap on 4K/Retina displays. */
  maxCanvasDpr?: number;
  /** Idle add/remove transition for the controlled `items` list. */
  itemsTransition?: boolean | Partial<ItemsTransitionConfig>;
  /** What to do when `items` changes before an active spin completes. */
  itemsChangeBehavior?: 'defer' | 'cancel-spin';
  /** Shortens spin and list transitions when the OS requests less motion. Default: true. */
  respectReducedMotion?: boolean;
  /** Width within the parent: CSS value such as "50%" or a pixel number. */
  size?: string | number;
  minSize?: string | number;
  maxSize?: string | number;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  theme?: WheelThemeOptions;
  pointer?: ReactNode;
  /** Edge on which the pointer is placed. Defaults to the top edge. */
  pointerPosition?: WheelPointerPosition;
  overlay?: ReactNode;
  center?: ReactNode;
  /** Size of the centre slot within the wheel, e.g. `"32%"` or `120`. */
  centerSize?: string | number;
  sounds?: WheelSoundConfig;
  spinAnimation?: Partial<SpinAnimationConfig>;
  /** Gentle wobble/pulse applied while idle. Disabled by default. */
  idleAnimation?: boolean | Partial<IdleAnimationConfig>;
  minLabelAngle?: number;
  /** Optional visual emphasis. Works in both SVG and Canvas renderers. */
  highlightedItemId?: string;
  onSpinStart?: () => void;
  onSectorPass?: (item: WheelItem<T>) => void;
  /** Fires only when the sector under the pointer changes; `null` means outside the wheel. */
  onSectorHover?: (sector: WheelSectorEvent<T> | null) => void;
  onSectorClick?: (sector: WheelSectorEvent<T>) => void;
  onSpinEnd?: (result: SpinResult<T>) => void;
  onSpinCancel?: (reason?: string) => void;
  onItemsTransitionStart?: () => void;
  onItemsTransitionEnd?: () => void;
  onError?: (error: Error) => void;
}
