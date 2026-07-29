import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { interpolateSectors, type Sector } from './geometry';
import { easingProgress } from './easing';
import { formatProbability } from './probability';
import type { SectorTextStyle, ShadowStyle, WheelCanvasDrawEvent, WheelHighlightStyle, WheelItem, WheelSectorImage, WheelTheme } from './types';

const MIN_DIVIDER_ANGLE = 0.75;
const LABEL_RADIUS_SCALE = 0.86;
const DEFAULT_HIGHLIGHT_STYLE: WheelHighlightStyle = { color: '#ffffff', opacity: 0.18, blendMode: 'source-over' };

/**
 * Controls how much visual information a Canvas draw includes. `full` is the
 * normal wheel; the lighter variants are reserved for item transitions.
 */
export type CanvasRenderDetail = 'full' | 'transition' | 'dense';

export interface WheelDrawingProps<T> {
  sectors: readonly Sector<T>[];
  theme: WheelTheme;
  minLabelAngle: number;
  showProbability?: boolean;
  highlightedItemId?: string;
  highlightStyle?: Partial<WheelHighlightStyle>;
  onCanvasDraw?: (event: WheelCanvasDrawEvent) => void;
  /** Render only sector fills/labels — useful for transition overlays. */
  decorations?: boolean;
  /** Level of detail used by the Canvas renderer. Defaults to `full`. */
  detail?: CanvasRenderDetail;
  className?: string;
  style?: CSSProperties;
}

function textAnchor(align: SectorTextStyle['align']): CanvasTextAlign {
  return align === 'start' ? 'left' : align === 'end' ? 'right' : 'center';
}

function sectorImage(item: WheelItem): WheelSectorImage | undefined {
  if (!item.image) return undefined;
  return typeof item.image === 'string' ? { src: item.image } : item.image;
}

function imageScale(image: WheelSectorImage): number {
  const value = image.scale ?? 1;
  return Number.isFinite(value) ? Math.min(Math.max(value, 0.05), 10) : 1;
}

function finiteNumber(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function imageRotation(image: WheelSectorImage): number {
  return finiteNumber(image.rotation);
}

function imageOffset(image: WheelSectorImage, axis: 'X' | 'Y'): number {
  const value = axis === 'X' ? image.offsetX : image.offsetY;
  return finiteNumber(value);
}

function labelRadius(text: SectorTextStyle, wheelRadius: number): number {
  return Math.min(Math.max(text.radius, 0), 1) * wheelRadius * LABEL_RADIUS_SCALE;
}

/**
 * A radial label reads along the radius, so its usable width is bounded by
 * the distance to the centre and rim—not by the sector's tangential arc.
 * This intentionally makes the fit calculation independent of sector angle.
 */
function radialLabelWidth(text: SectorTextStyle, labelRadius: number, wheelRadius: number): number {
  const inward = Math.max(0, labelRadius);
  const outward = Math.max(0, wheelRadius - labelRadius);
  if (text.align === 'start') return outward;
  if (text.align === 'end') return inward;
  return 2 * Math.min(inward, outward);
}

function colorAt<T>(sector: Sector<T>, theme: WheelTheme): string {
  return sector.item.color ?? theme.sector.colors[sector.index % theme.sector.colors.length] ?? theme.background;
}

function canvasFontSize(value: SectorTextStyle['fontSize'], size: number): number {
  if (typeof value === 'number') return Math.max(1, (value / 100) * size);
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return Math.max(1, (3.4 / 100) * size);
  return value.trim().endsWith('px') ? Math.max(1, parsed) : Math.max(1, (parsed / 100) * size);
}

const sectorImageCache = new Map<string, HTMLImageElement>();

/**
 * Images are shared by every Canvas instance. This avoids starting a second
 * network request when the same item is temporarily rendered in a transition
 * layer, while every active renderer still redraws once its image is ready.
 */
function useSectorImages<T>(sectors: readonly Sector<T>[]): { images: ReadonlyMap<string, HTMLImageElement>; version: number } {
  const [version, setVersion] = useState(0);
  const sources = useMemo(
    () => [...new Set(sectors.map((sector) => sectorImage(sector.item)?.src).filter((source): source is string => Boolean(source)))],
    [sectors],
  );
  const sourcesKey = sources.join('\u0001');

  useEffect(() => {
    const cleanup: Array<() => void> = [];
    for (const source of sources) {
      let image = sectorImageCache.get(source);
      if (!image) {
        image = new Image();
        image.decoding = 'async';
        image.src = source;
        sectorImageCache.set(source, image);
      }
      if (image.complete) continue;
      const redraw = () => setVersion((current) => current + 1);
      image.addEventListener('load', redraw, { once: true });
      image.addEventListener('error', redraw, { once: true });
      cleanup.push(() => {
        image?.removeEventListener('load', redraw);
        image?.removeEventListener('error', redraw);
      });
    }
    return () => cleanup.forEach((dispose) => dispose());
  }, [sources, sourcesKey]);

  return { images: sectorImageCache, version };
}

function drawImageInWheel(ctx: CanvasRenderingContext2D, image: HTMLImageElement, dimension: number, fit: WheelSectorImage['fit'], config: WheelSectorImage) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return;
  const center = dimension / 2;
  ctx.save();
  ctx.translate(
    center + (imageOffset(config, 'X') / 100) * dimension,
    center + (imageOffset(config, 'Y') / 100) * dimension,
  );
  ctx.rotate((imageRotation(config) * Math.PI) / 180);
  ctx.scale(imageScale(config), imageScale(config));
  if (fit === 'stretch') {
    ctx.drawImage(image, -center, -center, dimension, dimension);
  } else {
    const fitScale = fit === 'contain' ? Math.min(dimension / width, dimension / height) : Math.max(dimension / width, dimension / height);
    const drawWidth = width * fitScale;
    const drawHeight = height * fitScale;
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  }
  ctx.restore();
}

function applyCanvasShadow(ctx: CanvasRenderingContext2D, shadow: ShadowStyle, dimension: number) {
  ctx.shadowColor = shadow.color;
  ctx.shadowBlur = (Math.max(0, shadow.blur) / 100) * dimension;
  ctx.shadowOffsetX = (shadow.offsetX / 100) * dimension;
  ctx.shadowOffsetY = (shadow.offsetY / 100) * dimension;
}

interface CanvasMetrics {
  width: number;
  height: number;
  dpr: number;
}

interface CanvasSurface {
  ctx: CanvasRenderingContext2D;
  dimension: number;
  dpr: number;
}

interface PreparedCanvasSector<T> {
  sector: Sector<T>;
  color: string;
  text: SectorTextStyle;
  image?: WheelSectorImage;
  startRadians: number;
  endRadians: number;
  midRadians: number;
  midAngle: number;
  dividerX: number;
  dividerY: number;
}

interface FittedCanvasLabel {
  label: string;
  font: string;
  fontSize: number;
}

interface CanvasTextCache {
  measurements: Map<string, number>;
  labels: Map<string, FittedCanvasLabel | null>;
}

interface BaseBitmapCache<T> {
  canvas: HTMLCanvasElement;
  prepared: readonly PreparedCanvasSector<T>[];
  theme: WheelTheme;
  minLabelAngle: number;
  showProbability: boolean;
  decorations: boolean;
  detail: CanvasRenderDetail;
  imageVersion: number;
  dimension: number;
  dpr: number;
}

function useCanvasMetrics(ref: RefObject<HTMLCanvasElement | null>, maxCanvasDpr: number): CanvasMetrics {
  const [metrics, setMetrics] = useState<CanvasMetrics>({ width: 0, height: 0, dpr: 1 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const dprCap = Number.isFinite(maxCanvasDpr) ? Math.max(1, maxCanvasDpr) : 2;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), dprCap);
      setMetrics((current) => current.width === width && current.height === height && current.dpr === dpr
        ? current
        : { width, height, dpr });
    };

    let dprQuery: MediaQueryList | undefined;
    const watchDpr = () => {
      dprQuery?.removeEventListener('change', watchDpr);
      measure();
      dprQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprQuery?.addEventListener('change', watchDpr);
    };

    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    watchDpr();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      dprQuery?.removeEventListener('change', watchDpr);
    };
  }, [maxCanvasDpr, ref]);

  return metrics;
}

function prepareCanvas(canvas: HTMLCanvasElement, dimension: number, dpr: number): CanvasSurface | null {
  const bitmapDimension = Math.max(1, Math.round(dimension * dpr));
  if (canvas.width !== bitmapDimension || canvas.height !== bitmapDimension) {
    canvas.width = bitmapDimension;
    canvas.height = bitmapDimension;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, dimension, dpr };
}

function prepareCanvasSectors<T>(sectors: readonly Sector<T>[], theme: WheelTheme): PreparedCanvasSector<T>[] {
  return sectors.map((sector) => {
    const startRadians = (sector.start * Math.PI) / 180;
    const endRadians = (sector.end * Math.PI) / 180;
    const midAngle = sector.start + sector.angle / 2;
    const midRadians = (midAngle * Math.PI) / 180;
    return {
      sector,
      color: colorAt(sector, theme),
      text: { ...theme.text, ...sector.item.text },
      image: sectorImage(sector.item),
      startRadians,
      endRadians,
      midRadians,
      midAngle,
      dividerX: Math.cos(startRadians),
      dividerY: Math.sin(startRadians),
    };
  });
}

function drawSectorPath<T>(ctx: CanvasRenderingContext2D, sector: PreparedCanvasSector<T>, center: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(center, center);
  ctx.arc(center, center, radius, sector.startRadians, sector.endRadians);
  ctx.closePath();
}

function drawBackground(ctx: CanvasRenderingContext2D, dimension: number, theme: WheelTheme) {
  const center = dimension / 2;
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fillStyle = theme.background;
  ctx.fill();
}

function drawSectorFills<T>(ctx: CanvasRenderingContext2D, sectors: readonly PreparedCanvasSector<T>[], dimension: number) {
  const center = dimension / 2;
  for (const sector of sectors) {
    drawSectorPath(ctx, sector, center, center);
    ctx.fillStyle = sector.color;
    ctx.fill();
  }
}

function drawSectorImages<T>(ctx: CanvasRenderingContext2D, sectors: readonly PreparedCanvasSector<T>[], dimension: number, images: ReadonlyMap<string, HTMLImageElement>) {
  const center = dimension / 2;
  for (const sector of sectors) {
    const imageConfig = sector.image;
    const image = imageConfig?.src ? images.get(imageConfig.src) : undefined;
    if (!imageConfig || !image?.complete || !image.naturalWidth || !image.naturalHeight) continue;
    ctx.save();
    drawSectorPath(ctx, sector, center, center);
    ctx.clip();
    ctx.globalAlpha = Math.min(Math.max(imageConfig.opacity ?? 1, 0), 1);
    drawImageInWheel(ctx, image, dimension, imageConfig.fit ?? 'cover', imageConfig);
    ctx.restore();
  }
}

function drawDividers<T>(ctx: CanvasRenderingContext2D, sectors: readonly PreparedCanvasSector<T>[], dimension: number, theme: WheelTheme, withShadows = true) {
  if (sectors.length <= 1 || theme.dividers.width <= 0) return;
  const center = dimension / 2;
  let hasDividers = false;
  ctx.save();
  ctx.beginPath();
  for (const sector of sectors) {
    if (sector.sector.angle < MIN_DIVIDER_ANGLE) continue;
    ctx.moveTo(center, center);
    ctx.lineTo(center + center * sector.dividerX, center + center * sector.dividerY);
    hasDividers = true;
  }
  if (hasDividers) {
    ctx.strokeStyle = theme.dividers.color;
    ctx.lineWidth = (theme.dividers.width / 100) * dimension;
    if (withShadows) applyCanvasShadow(ctx, theme.dividers.shadow, dimension);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBorder(ctx: CanvasRenderingContext2D, dimension: number, theme: WheelTheme, withShadow = true) {
  if (theme.border.width <= 0) return;
  const center = dimension / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, center - (theme.border.width / 100) * dimension / 2, 0, Math.PI * 2);
  ctx.strokeStyle = theme.border.color;
  ctx.lineWidth = (theme.border.width / 100) * dimension;
  if (withShadow) applyCanvasShadow(ctx, theme.border.shadow, dimension);
  ctx.stroke();
  ctx.restore();
}

function cacheValue<T>(cache: Map<string, T>, key: string, value: T): T {
  if (cache.size > 4_000) cache.clear();
  cache.set(key, value);
  return value;
}

function measureCachedText(ctx: CanvasRenderingContext2D, cache: CanvasTextCache, font: string, value: string): number {
  const key = `${font}\u0000${value}`;
  const cached = cache.measurements.get(key);
  if (cached !== undefined) return cached;
  ctx.font = font;
  return cacheValue(cache.measurements, key, ctx.measureText(value).width);
}

function ellipsizeCanvasLabel(ctx: CanvasRenderingContext2D, cache: CanvasTextCache, value: string, font: string, maxWidth: number): string {
  const suffix = '…';
  let end = value.length;
  while (end > 0 && measureCachedText(ctx, cache, font, `${value.slice(0, end)}${suffix}`) > maxWidth) end -= 1;
  return end > 0 ? `${value.slice(0, end)}${suffix}` : '';
}

function fitCachedCanvasLabel(
  ctx: CanvasRenderingContext2D,
  cache: CanvasTextCache,
  key: string,
  label: string,
  maxWidth: number,
  overflow: SectorTextStyle['overflow'],
  font: string,
  fontSize: number,
  fontWeight: SectorTextStyle['fontWeight'],
  fontFamily: string,
): FittedCanvasLabel | null {
  const cached = cache.labels.get(key);
  if (cached !== undefined) return cached;
  let fitted: FittedCanvasLabel | null = null;
  if (maxWidth >= 12) {
    const width = measureCachedText(ctx, cache, font, label);
    if (width <= maxWidth) fitted = { label, font, fontSize };
    else if (overflow === 'ellipsis') {
      const shortened = ellipsizeCanvasLabel(ctx, cache, label, font, maxWidth);
      if (shortened) fitted = { label: shortened, font, fontSize };
    } else if (overflow === 'shrink') {
      const shrunkSize = Math.max(fontSize * 0.55, fontSize * (maxWidth / width));
      fitted = { label, font: `${fontWeight} ${shrunkSize}px ${fontFamily}`, fontSize: shrunkSize };
    }
  }
  return cacheValue(cache.labels, key, fitted);
}

function drawLabels<T>(
  ctx: CanvasRenderingContext2D,
  sectors: readonly PreparedCanvasSector<T>[],
  dimension: number,
  minLabelAngle: number,
  showProbability: boolean,
  cache: CanvasTextCache,
) {
  const center = dimension / 2;
  for (const sector of sectors) {
    if (sector.sector.angle < minLabelAngle) continue;
    const { text } = sector;
    const fontSize = canvasFontSize(text.fontSize, dimension);
    const font = `${text.fontWeight} ${fontSize}px ${text.fontFamily}`;
    const probability = showProbability
      ? formatProbability(sector.sector.angle / 360)
      : undefined;
    const probabilityFontSize = Math.max(1, fontSize * 0.72);
    const probabilityFont = `${text.fontWeight} ${probabilityFontSize}px ${text.fontFamily}`;
    const labelPositionRadius = labelRadius(text, center);
    const arcLength = (sector.sector.angle / 360) * Math.PI * 2 * labelPositionRadius;
    const maxWidth = text.maxWidth === undefined
      ? text.orientation === 'radial'
        ? radialLabelWidth(text, labelPositionRadius, center)
        : Math.max(0, arcLength * 0.78)
      : (text.maxWidth / 100) * dimension;
    const labelKey = [
      dimension,
      sector.sector.item.id,
      sector.sector.item.label,
      sector.sector.start,
      sector.sector.end,
      maxWidth,
      font,
      text.overflow,
    ].join('\u0001');
    const fittedLabel = fitCachedCanvasLabel(
      ctx,
      cache,
      labelKey,
      sector.sector.item.label,
      maxWidth,
      text.overflow,
      font,
      fontSize,
      text.fontWeight,
      text.fontFamily,
    );
    const fittedProbability = probability && fitCachedCanvasLabel(
      ctx,
      cache,
      `${labelKey}\u0001probability\u0001${probability}\u0001${probabilityFont}`,
      probability,
      maxWidth,
      text.overflow,
      probabilityFont,
      probabilityFontSize,
      text.fontWeight,
      text.fontFamily,
    );
    if (!fittedLabel && !fittedProbability) continue;
    ctx.save();
    drawSectorPath(ctx, sector, center, center);
    ctx.clip();
    ctx.fillStyle = text.color;
    ctx.textAlign = textAnchor(text.align);
    ctx.textBaseline = 'middle';
    ctx.translate(
      center + labelPositionRadius * Math.cos(sector.midRadians) + (text.offsetX / 100) * dimension,
      center + labelPositionRadius * Math.sin(sector.midRadians) + (text.offsetY / 100) * dimension,
    );
    const rotation = text.orientation === 'radial' ? sector.midAngle : text.orientation === 'tangential' ? sector.midAngle + 90 : 0;
    ctx.rotate((rotation * Math.PI) / 180);
    applyCanvasShadow(ctx, text.shadow, dimension);
    const labelY = fittedProbability ? -probabilityFontSize * 0.48 : 0;
    if (fittedLabel) {
      ctx.font = fittedLabel.font;
      ctx.fillText(fittedLabel.label, 0, labelY, maxWidth);
      if (text.strokeWidth > 0) {
        ctx.strokeStyle = text.strokeColor;
        ctx.lineWidth = (text.strokeWidth / 100) * dimension;
        ctx.lineJoin = 'round';
        ctx.strokeText(fittedLabel.label, 0, labelY, maxWidth);
      }
    }
    if (fittedProbability) {
      ctx.globalAlpha = 0.86;
      ctx.font = fittedProbability.font;
      const probabilityY = fittedLabel ? Math.max(fontSize, probabilityFontSize) * 0.54 : 0;
      ctx.fillText(fittedProbability.label, 0, probabilityY, maxWidth);
      if (text.strokeWidth > 0) {
        ctx.strokeStyle = text.strokeColor;
        ctx.lineWidth = (text.strokeWidth / 100) * dimension;
        ctx.lineJoin = 'round';
        ctx.strokeText(fittedProbability.label, 0, probabilityY, maxWidth);
      }
    }
    ctx.restore();
  }
}

function drawCanvasFrame<T>(
  ctx: CanvasRenderingContext2D,
  sectors: readonly PreparedCanvasSector<T>[],
  dimension: number,
  theme: WheelTheme,
  minLabelAngle: number,
  showProbability: boolean,
  decorations: boolean,
  detail: CanvasRenderDetail,
  images: ReadonlyMap<string, HTMLImageElement>,
  textCache: CanvasTextCache,
) {
  ctx.clearRect(0, 0, dimension, dimension);
  if (decorations) drawBackground(ctx, dimension, theme);
  drawSectorFills(ctx, sectors, dimension);
  if (detail === 'full') {
    drawSectorImages(ctx, sectors, dimension, images);
    drawLabels(ctx, sectors, dimension, minLabelAngle, showProbability, textCache);
  } else if (detail === 'dense') {
    drawLabels(ctx, sectors, dimension, minLabelAngle, showProbability, textCache);
  }
  if (decorations) {
    const simplified = detail === 'transition';
    drawDividers(ctx, sectors, dimension, theme, !simplified);
    drawBorder(ctx, dimension, theme, !simplified);
  }
}

function drawHighlight<T>(ctx: CanvasRenderingContext2D, sectors: readonly Sector<T>[], dimension: number, highlightedItemId: string | undefined, highlightStyle?: Partial<WheelHighlightStyle>) {
  if (!highlightedItemId) return;
  const highlighted = sectors.find((sector) => sector.item.id === highlightedItemId);
  if (!highlighted) return;
  const center = dimension / 2;
  const resolved = { ...DEFAULT_HIGHLIGHT_STYLE, ...highlightStyle };
  ctx.save();
  ctx.globalCompositeOperation = resolved.blendMode ?? 'source-over';
  ctx.globalAlpha = Math.min(Math.max(resolved.opacity, 0), 1);
  ctx.beginPath();
  ctx.moveTo(center, center);
  ctx.arc(center, center, center, (highlighted.start * Math.PI) / 180, (highlighted.end * Math.PI) / 180);
  ctx.closePath();
  ctx.fillStyle = resolved.color;
  ctx.fill();
  ctx.restore();
}

function CanvasHighlightRenderer<T>({
  sectors,
  highlightedItemId,
  highlightStyle,
  maxCanvasDpr,
  onCanvasDraw,
}: Pick<WheelDrawingProps<T>, 'sectors' | 'highlightedItemId' | 'highlightStyle' | 'onCanvasDraw'> & { maxCanvasDpr: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const metrics = useCanvasMetrics(ref, maxCanvasDpr);

  useEffect(() => {
    const canvas = ref.current;
    const dimension = Math.min(metrics.width, metrics.height);
    if (!canvas || dimension <= 0) return;
    const surface = prepareCanvas(canvas, dimension, metrics.dpr);
    if (!surface) return;
    surface.ctx.clearRect(0, 0, dimension, dimension);
    drawHighlight(surface.ctx, sectors, dimension, highlightedItemId, highlightStyle);
    onCanvasDraw?.({ layer: 'highlight', detail: 'full' });
  }, [highlightStyle, highlightedItemId, metrics, onCanvasDraw, sectors]);

  return <canvas ref={ref} className="wheel__canvas wheel__canvas--highlight" aria-hidden="true" />;
}

function shouldRebuildBase<T>(
  cache: BaseBitmapCache<T> | null,
  prepared: readonly PreparedCanvasSector<T>[],
  theme: WheelTheme,
  minLabelAngle: number,
  showProbability: boolean,
  decorations: boolean,
  detail: CanvasRenderDetail,
  imageVersion: number,
  dimension: number,
  dpr: number,
): boolean {
  return !cache
    || cache.prepared !== prepared
    || cache.theme !== theme
    || cache.minLabelAngle !== minLabelAngle
    || cache.showProbability !== showProbability
    || cache.decorations !== decorations
    || cache.detail !== detail
    || cache.imageVersion !== imageVersion
    || cache.dimension !== dimension
    || cache.dpr !== dpr;
}

export interface WheelCanvasTransitionProps<T> {
  from: readonly Sector<T>[];
  to: readonly Sector<T>[];
  theme: WheelTheme;
  minLabelAngle: number;
  showProbability?: boolean;
  duration: number;
  easing: string;
  /** `transition` skips labels, images and shadows for the 51–150 sector LOD. */
  detail: Extract<CanvasRenderDetail, 'full' | 'transition'>;
  decorations?: boolean;
  className?: string;
  style?: CSSProperties;
  maxCanvasDpr?: number;
  onCanvasDraw?: (event: WheelCanvasDrawEvent) => void;
}

/**
 * Imperative Canvas collapse. Progress stays in the animation loop, not in
 * React state, so the sector list is never reconciled once per animation frame.
 */
function WheelCanvasTransitionRendererInner<T>({
  from,
  to,
  theme,
  minLabelAngle,
  showProbability = false,
  duration,
  easing,
  detail,
  decorations = true,
  className,
  style,
  maxCanvasDpr = 2,
  onCanvasDraw,
}: WheelCanvasTransitionProps<T>) {
  const ref = useRef<HTMLCanvasElement>(null);
  const metrics = useCanvasMetrics(ref, maxCanvasDpr);
  const imageSectors = useMemo(() => [...from, ...to], [from, to]);
  const { images, version: imageVersion } = useSectorImages(imageSectors);
  const textCacheRef = useRef<CanvasTextCache>({ measurements: new Map(), labels: new Map() });

  useEffect(() => {
    const canvas = ref.current;
    const dimension = Math.min(metrics.width, metrics.height);
    if (!canvas || dimension <= 0) return;
    let frame = 0;
    let startedAt: number | undefined;
    let lastDrawAt = -Infinity;
    const minimumFrameTime = detail === 'transition' ? 1000 / 30 : 1000 / 60;

    const draw = (progress: number) => {
      const surface = prepareCanvas(canvas, dimension, metrics.dpr);
      if (!surface) return;
      const sectors = prepareCanvasSectors(interpolateSectors(from, to, easingProgress(progress, easing)), theme);
      drawCanvasFrame(surface.ctx, sectors, dimension, theme, minLabelAngle, showProbability, decorations, detail, images, textCacheRef.current);
      onCanvasDraw?.({ layer: 'transition', detail });
    };

    const animate = (now: number) => {
      startedAt ??= now;
      const progress = Math.min(1, (now - startedAt) / Math.max(1, duration));
      if (progress === 1 || now - lastDrawAt >= minimumFrameTime) {
        draw(progress);
        lastDrawAt = now;
      }
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    draw(0);
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [decorations, detail, duration, easing, from, imageVersion, images, metrics, minLabelAngle, onCanvasDraw, showProbability, theme, to]);

  return <canvas ref={ref} className={['wheel__canvas', className].filter(Boolean).join(' ')} style={{ backgroundColor: theme.background, borderRadius: '50%', ...style }} aria-hidden="true" />;
}

export const WheelCanvasTransitionRenderer = memo(WheelCanvasTransitionRendererInner) as typeof WheelCanvasTransitionRendererInner;

function WheelCanvasRendererInner<T>({
  sectors,
  theme,
  minLabelAngle,
  showProbability = false,
  highlightedItemId,
  highlightStyle,
  onCanvasDraw,
  decorations = true,
  detail = 'full',
  className,
  style,
  maxCanvasDpr = 2,
}: WheelDrawingProps<T> & { maxCanvasDpr?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const metrics = useCanvasMetrics(ref, maxCanvasDpr);
  const { images, version: imageVersion } = useSectorImages(sectors);
  const prepared = useMemo(() => prepareCanvasSectors(sectors, theme), [sectors, theme]);
  const baseBitmapRef = useRef<BaseBitmapCache<T> | null>(null);
  const textCacheRef = useRef<CanvasTextCache>({ measurements: new Map(), labels: new Map() });

  useEffect(() => {
    const canvas = ref.current;
    const dimension = Math.min(metrics.width, metrics.height);
    if (!canvas || dimension <= 0) return;
    const surface = prepareCanvas(canvas, dimension, metrics.dpr);
    if (!surface) return;

    let base = baseBitmapRef.current;
    if (shouldRebuildBase(base, prepared, theme, minLabelAngle, showProbability, decorations, detail, imageVersion, dimension, metrics.dpr)) {
      const bitmapCanvas = base?.canvas ?? document.createElement('canvas');
      const bitmapSurface = prepareCanvas(bitmapCanvas, dimension, metrics.dpr);
      if (!bitmapSurface) return;
      drawCanvasFrame(bitmapSurface.ctx, prepared, dimension, theme, minLabelAngle, showProbability, decorations, detail, images, textCacheRef.current);
      base = {
        canvas: bitmapCanvas,
        prepared,
        theme,
        minLabelAngle,
        showProbability,
        decorations,
        detail,
        imageVersion,
        dimension,
        dpr: metrics.dpr,
      };
      baseBitmapRef.current = base;
    }

    if (!base) return;
    surface.ctx.clearRect(0, 0, dimension, dimension);
    surface.ctx.drawImage(base.canvas, 0, 0, dimension, dimension);
    onCanvasDraw?.({ layer: 'base', detail });
  }, [decorations, detail, imageVersion, images, metrics, minLabelAngle, onCanvasDraw, prepared, showProbability, theme]);

  return <>
    <canvas ref={ref} className={['wheel__canvas', className].filter(Boolean).join(' ')} style={{ backgroundColor: theme.background, borderRadius: '50%', ...style }} aria-hidden="true" />
    {highlightedItemId && <CanvasHighlightRenderer sectors={sectors} highlightedItemId={highlightedItemId} highlightStyle={highlightStyle} onCanvasDraw={onCanvasDraw} maxCanvasDpr={maxCanvasDpr} />}
  </>;
}

/**
 * Canvas renderer for dense wheels. The base wheel is cached as an offscreen
 * bitmap, so a hover/highlight only composites that bitmap and its overlay.
 */
export const WheelCanvasRenderer = memo(WheelCanvasRendererInner) as typeof WheelCanvasRendererInner;
