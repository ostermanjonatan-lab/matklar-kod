import React, { useState } from 'react';
import { hasCoverImage } from '../../utils/coverImage';
import { sizedImage, type ImageSize } from '../../utils/imageUrl';
import { NoImage } from './NoImage';

type FadeImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  /** Used if the picture cannot be loaded. */
  fallbackSrc?: string;
  /** The size the picture is shown at, so that a small box does not fetch a big picture */
  size?: ImageSize;
  /** For the pictures seen first on a screen: fetched before the others */
  priority?: boolean;
};

const DEFAULT_FALLBACK = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80';

/**
 * A photo that fades in when it has loaded. Until then the place it fills shows a skeleton,
 * so put it in a box with a size (the box gets the skeleton look while the photo loads).
 * A recipe without a picture of its own gets the grey Ingen bild vald box instead.
 */
export const FadeImage: React.FC<FadeImageProps> = ({
  className = '',
  fallbackSrc = DEFAULT_FALLBACK,
  size = 'card',
  priority = false,
  loading,
  onLoad,
  onError,
  src,
  ...rest
}) => {
  const [loaded, setLoaded] = useState(false);
  // If the smaller picture cannot be had (the image service is out of its monthly quota), the original is used
  const [useOriginal, setUseOriginal] = useState(false);
  if (!hasCoverImage(src)) return <NoImage />;
  const shown = useOriginal ? src : sizedImage(src, size);
  return (
    <>
      {!loaded && <span aria-hidden="true" className="skeleton absolute inset-0 block" />}
      <img
        {...rest}
        src={shown}
        loading={priority ? 'eager' : loading}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          const el = e.currentTarget;
          if (shown !== src) {
            setUseOriginal(true);
          } else if (fallbackSrc && el.src !== fallbackSrc) {
            el.src = fallbackSrc;
          } else {
            setLoaded(true);
          }
          onError?.(e);
        }}
      />
    </>
  );
};
