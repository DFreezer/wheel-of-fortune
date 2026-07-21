import type { ImgHTMLAttributes, VideoHTMLAttributes } from 'react';

export interface WheelMediaProps {
  src: string;
  /** The `auto` mode treats common video URLs as video and everything else as an image. */
  as?: 'auto' | 'image' | 'video';
  alt?: string;
  className?: string;
  imageProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'className'>;
  videoProps?: Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src' | 'className'>;
}

/**
 * A small convenience slot for overlay, center and pointer artwork.
 * You can always pass native `<img>`, inline SVG or `<video>` to those slots instead.
 */
export function WheelMedia({ src, as = 'auto', alt = '', className, imageProps, videoProps }: WheelMediaProps) {
  const isVideo = as === 'video' || (as === 'auto' && /\.(webm|mp4|ogg)(?:$|[?#])/i.test(src));
  if (isVideo) {
    return <video src={src} className={className} autoPlay loop muted playsInline aria-hidden={alt ? undefined : true} {...videoProps} />;
  }
  return <img src={src} alt={alt} className={className} {...imageProps} />;
}
