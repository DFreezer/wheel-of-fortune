import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { polar, wedgePath, type Sector } from './geometry';
import type { SectorTextStyle, ShadowStyle, WheelItem, WheelSectorImage, WheelTheme } from './types';

const MIN_DIVIDER_ANGLE = 0.75;

export interface WheelDrawingProps<T> {
  sectors: readonly Sector<T>[];
  theme: WheelTheme;
  minLabelAngle: number;
  highlightedItemId?: string;
  /** Render only sector fills/labels — useful for transition overlays. */
  decorations?: boolean;
  className?: string;
  style?: CSSProperties;
}

function textAnchor(align: SectorTextStyle['align']): CanvasTextAlign {
  return align === 'start' ? 'left' : align === 'end' ? 'right' : 'center';
}

function viewBoxFontSize(value: SectorTextStyle['fontSize']): number {
  if (typeof value === 'number') return Math.max(0.1, value);
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0.1, parsed) : 3.4;
}

function cssShadow(shadow: ShadowStyle): string | undefined {
  if (!shadow.color || shadow.color === 'transparent' || shadow.blur <= 0) return undefined;
  return `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color})`;
}

function sectorImage(item: WheelItem): WheelSectorImage | undefined {
  if (!item.image) return undefined;
  return typeof item.image === 'string' ? { src: item.image } : item.image;
}

function imagePreserveAspectRatio(image: WheelSectorImage): string {
  if (image.fit === 'stretch') return 'none';
  return image.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
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

function imageTransform(image: WheelSectorImage): string {
  const offsetX = imageOffset(image, 'X');
  const offsetY = imageOffset(image, 'Y');
  return `translate(${offsetX} ${offsetY}) translate(50 50) rotate(${imageRotation(image)}) scale(${imageScale(image)}) translate(-50 -50)`;
}

function labelPoint(text: SectorTextStyle, sector: Sector): { x: number; y: number; rotation: number } {
  const mid = sector.start + sector.angle / 2;
  const point = polar(Math.min(Math.max(text.radius, 0), 1) * 43, mid);
  return {
    x: point.x + text.offsetX,
    y: point.y + text.offsetY,
    rotation: text.orientation === 'radial' ? mid : text.orientation === 'tangential' ? mid + 90 : 0,
  };
}

function colorAt<T>(sector: Sector<T>, theme: WheelTheme): string {
  return sector.item.color ?? theme.sector.colors[sector.index % theme.sector.colors.length] ?? theme.background;
}

function shouldShowSvgLabel<T>(sector: Sector<T>, text: SectorTextStyle, minLabelAngle: number): boolean {
  return sector.angle >= minLabelAngle && text.overflow !== 'hide';
}

let measureContext: CanvasRenderingContext2D | null | undefined;

function measureTextWidth(value: string, font: string, fallbackFontSize: number): number {
  if (measureContext === undefined && typeof document !== 'undefined') {
    measureContext = document.createElement('canvas').getContext('2d');
  }
  if (measureContext) {
    measureContext.font = font;
    return measureContext.measureText(value).width;
  }
  return value.length * fallbackFontSize * 0.58;
}

function fitSvgLabel(
  text: SectorTextStyle,
  sector: Sector,
): { label: string; fontSize: number } | null {
  const fontSize = viewBoxFontSize(text.fontSize);
  const radius = Math.min(Math.max(text.radius, 0), 1) * 43;
  const arcWidth = Math.max(0, radius * ((sector.angle * Math.PI) / 180) * 0.76);
  const maxWidth = text.maxWidth === undefined ? arcWidth : Math.max(0, text.maxWidth);
  if (maxWidth < fontSize * 1.4) return null;
  const font = `${text.fontWeight} ${fontSize}px ${text.fontFamily}`;
  const width = measureTextWidth(sector.item.label, font, fontSize);
  if (width <= maxWidth) return { label: sector.item.label, fontSize };
  if (text.overflow === 'hide') return null;
  if (text.overflow === 'shrink') {
    return { label: sector.item.label, fontSize: Math.max(fontSize * 0.55, fontSize * (maxWidth / width)) };
  }
  const suffix = '…';
  let end = sector.item.label.length;
  while (end > 0 && measureTextWidth(`${sector.item.label.slice(0, end)}${suffix}`, font, fontSize) > maxWidth) end -= 1;
  return end > 0 ? { label: `${sector.item.label.slice(0, end)}${suffix}`, fontSize } : null;
}

/** SVG keeps per-sector DOM access and is the most customisable renderer. */
export function WheelSvgRenderer<T>({ sectors, theme, minLabelAngle, highlightedItemId, decorations = true, className, style }: WheelDrawingProps<T>) {
  const rendererId = useId().replace(/:/g, '');
  return (
    <svg className={['wheel__svg', className].filter(Boolean).join(' ')} style={style} viewBox="0 0 100 100" aria-hidden="true">
      {decorations && <circle cx="50" cy="50" r="50" fill={theme.background} />}
      {sectors.map((sector) => {
        const text = { ...theme.text, ...sector.item.text };
        const label = labelPoint(text, sector);
        const anchor = text.align === 'start' ? 'start' : text.align === 'end' ? 'end' : 'middle';
        const image = sectorImage(sector.item);
        const clipId = `wheel-sector-${rendererId}-${sector.index}-${sector.item.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
        const fittedLabel = shouldShowSvgLabel(sector, text, minLabelAngle) ? fitSvgLabel(text, sector) : null;
        const labelShadow = cssShadow(text.shadow);
        return (
          <g key={sector.item.id} className={['wheel__sector', sector.item.id === highlightedItemId && 'wheel__sector--highlighted'].filter(Boolean).join(' ')}>
            <defs><clipPath id={clipId}><path d={wedgePath(sector.start, sector.end)} /></clipPath></defs>
            <path d={wedgePath(sector.start, sector.end)} fill={colorAt(sector, theme)} />
            <g clipPath={`url(#${clipId})`}>
              {image?.src && <image href={image.src} x="0" y="0" width="100" height="100" opacity={Math.min(Math.max(image.opacity ?? 1, 0), 1)} preserveAspectRatio={imagePreserveAspectRatio(image)} transform={imageTransform(image)} />}
              {fittedLabel && (
                <text
                  x={label.x}
                  y={label.y}
                  fill={text.color}
                  stroke={text.strokeWidth > 0 ? text.strokeColor : undefined}
                  strokeWidth={text.strokeWidth > 0 ? text.strokeWidth : undefined}
                  fontFamily={text.fontFamily}
                  fontSize={fittedLabel.fontSize}
                  fontWeight={text.fontWeight}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  transform={`rotate(${label.rotation} ${label.x} ${label.y})`}
                  style={labelShadow ? { filter: labelShadow } : undefined}
                >
                  {fittedLabel.label}
                </text>
              )}
            </g>
          </g>
        );
      })}
      {decorations && sectors.length > 1 && sectors.map((sector) => {
        if (sector.angle < MIN_DIVIDER_ANGLE) return null;
        const point = polar(50, sector.start);
        const shadow = cssShadow(theme.dividers.shadow);
        return <line key={`divider-${sector.item.id}`} x1="50" y1="50" x2={point.x} y2={point.y} stroke={theme.dividers.color} strokeWidth={theme.dividers.width} style={shadow ? { filter: shadow } : undefined} />;
      })}
      {decorations && <circle cx="50" cy="50" r={50 - theme.border.width / 2} fill="none" stroke={theme.border.color} strokeWidth={theme.border.width} />}
    </svg>
  );
}

function canvasFontSize(value: SectorTextStyle['fontSize'], size: number): number {
  if (typeof value === 'number') return Math.max(1, (value / 100) * size);
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return Math.max(1, (3.4 / 100) * size);
  return value.trim().endsWith('px') ? Math.max(1, parsed) : Math.max(1, (parsed / 100) * size);
}

function useSectorImages<T>(sectors: readonly Sector<T>[]): { images: Map<string, HTMLImageElement>; version: number } {
  const images = useRef(new Map<string, HTMLImageElement>());
  const [version, setVersion] = useState(0);
  const sources = sectors.map((sector) => sectorImage(sector.item)?.src ?? '').filter(Boolean).join('\u0001');
  useEffect(() => {
    for (const source of new Set(sources.split('\u0001').filter(Boolean))) {
      if (images.current.has(source)) continue;
      const image = new Image();
      image.decoding = 'async';
      image.addEventListener('load', () => setVersion((current) => current + 1), { once: true });
      image.src = source;
      images.current.set(source, image);
    }
  }, [sources]);
  return { images: images.current, version };
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

function ellipseLabel(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  const suffix = '…';
  let end = value.length;
  while (end > 0 && ctx.measureText(`${value.slice(0, end)}${suffix}`).width > maxWidth) end -= 1;
  return end > 0 ? `${value.slice(0, end)}${suffix}` : '';
}

function fitCanvasLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  maxWidth: number,
  overflow: SectorTextStyle['overflow'],
  fontSize: number,
): { label: string; fontSize: number } | null {
  if (maxWidth < 12) return null;
  const width = ctx.measureText(label).width;
  if (width <= maxWidth) return { label, fontSize };
  if (overflow === 'hide') return null;
  if (overflow === 'ellipsis') {
    const shortened = ellipseLabel(ctx, label, maxWidth);
    return shortened ? { label: shortened, fontSize } : null;
  }
  return { label, fontSize: Math.max(fontSize * 0.55, fontSize * (maxWidth / width)) };
}

function useCanvasSize(ref: RefObject<HTMLCanvasElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setSize((current) => current.width === width && current.height === height ? current : { width, height });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/**
 * Canvas renderer for dense wheels. It keeps a single drawing surface and
 * automatically removes labels/dividers that cannot be legible at this size.
 */
export function WheelCanvasRenderer<T>({ sectors, theme, minLabelAngle, highlightedItemId, decorations = true, className, style, maxCanvasDpr = 2 }: WheelDrawingProps<T> & { maxCanvasDpr?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(ref);
  const { images, version: imageVersion } = useSectorImages(sectors);

  useEffect(() => {
    const canvas = ref.current;
    const dimension = Math.min(size.width, size.height);
    if (!canvas || dimension <= 0) return;
    const dprCap = Number.isFinite(maxCanvasDpr) ? Math.max(1, maxCanvasDpr) : 2;
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), dprCap);
    const bitmap = Math.max(1, Math.round(dimension * dpr));
    if (canvas.width !== bitmap || canvas.height !== bitmap) {
      canvas.width = bitmap;
      canvas.height = bitmap;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dimension, dimension);

    const center = dimension / 2;
    const radius = dimension / 2;
    if (decorations) {
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fillStyle = theme.background;
      ctx.fill();
    }

    for (const sector of sectors) {
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, (sector.start * Math.PI) / 180, (sector.end * Math.PI) / 180);
      ctx.closePath();
      ctx.fillStyle = colorAt(sector, theme);
      ctx.fill();
    }

    for (const sector of sectors) {
      const imageConfig = sectorImage(sector.item);
      const image = imageConfig?.src ? images.get(imageConfig.src) : undefined;
      if (!image?.complete || !imageConfig) continue;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, (sector.start * Math.PI) / 180, (sector.end * Math.PI) / 180);
      ctx.closePath();
      ctx.clip();
      ctx.globalAlpha = Math.min(Math.max(imageConfig.opacity ?? 1, 0), 1);
      drawImageInWheel(ctx, image, dimension, imageConfig.fit ?? 'cover', imageConfig);
      ctx.restore();
    }

    const highlighted = highlightedItemId ? sectors.find((sector) => sector.item.id === highlightedItemId) : undefined;
    if (highlighted) {
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, (highlighted.start * Math.PI) / 180, (highlighted.end * Math.PI) / 180);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fill();
    }

    if (decorations && sectors.length > 1 && theme.dividers.width > 0) {
      ctx.save();
      ctx.strokeStyle = theme.dividers.color;
      ctx.lineWidth = (theme.dividers.width / 100) * dimension;
      applyCanvasShadow(ctx, theme.dividers.shadow, dimension);
      for (const sector of sectors) {
        if (sector.angle < MIN_DIVIDER_ANGLE) continue;
        const radians = (sector.start * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.lineTo(center + radius * Math.cos(radians), center + radius * Math.sin(radians));
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const sector of sectors) {
      const text = { ...theme.text, ...sector.item.text };
      if (sector.angle < minLabelAngle && text.overflow === 'hide') continue;
      const fontSize = canvasFontSize(text.fontSize, dimension);
      const mid = sector.start + sector.angle / 2;
      const labelRadius = Math.min(Math.max(text.radius, 0), 1) * radius * 0.86;
      const arcLength = (sector.angle / 360) * Math.PI * 2 * labelRadius;
      if (arcLength < 22) continue;
      const maxWidth = text.maxWidth === undefined
        ? Math.max(0, arcLength * 0.78)
        : (text.maxWidth / 100) * dimension;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, (sector.start * Math.PI) / 180, (sector.end * Math.PI) / 180);
      ctx.closePath();
      ctx.clip();
      ctx.font = `${text.fontWeight} ${fontSize}px ${text.fontFamily}`;
      const fitted = fitCanvasLabel(ctx, sector.item.label, maxWidth, text.overflow, fontSize);
      if (!fitted) {
        ctx.restore();
        continue;
      }
      ctx.font = `${text.fontWeight} ${fitted.fontSize}px ${text.fontFamily}`;
      ctx.fillStyle = text.color;
      ctx.textAlign = textAnchor(text.align);
      ctx.textBaseline = 'middle';
      const radians = (mid * Math.PI) / 180;
      ctx.translate(
        center + labelRadius * Math.cos(radians) + (text.offsetX / 100) * dimension,
        center + labelRadius * Math.sin(radians) + (text.offsetY / 100) * dimension,
      );
      const rotation = text.orientation === 'radial' ? mid : text.orientation === 'tangential' ? mid + 90 : 0;
      ctx.rotate((rotation * Math.PI) / 180);
      applyCanvasShadow(ctx, text.shadow, dimension);
      ctx.fillText(fitted.label, 0, 0, maxWidth);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      if (text.strokeWidth > 0) {
        ctx.strokeStyle = text.strokeColor;
        ctx.lineWidth = (text.strokeWidth / 100) * dimension;
        ctx.lineJoin = 'round';
        ctx.strokeText(fitted.label, 0, 0, maxWidth);
      }
      ctx.restore();
    }

    if (decorations && theme.border.width > 0) {
      ctx.beginPath();
      ctx.arc(center, center, radius - (theme.border.width / 100) * dimension / 2, 0, Math.PI * 2);
      ctx.strokeStyle = theme.border.color;
      ctx.lineWidth = (theme.border.width / 100) * dimension;
      ctx.stroke();
    }
  }, [decorations, highlightedItemId, imageVersion, images, maxCanvasDpr, minLabelAngle, sectors, size, theme]);

  return <canvas ref={ref} className={['wheel__canvas', className].filter(Boolean).join(' ')} style={style} aria-hidden="true" />;
}
