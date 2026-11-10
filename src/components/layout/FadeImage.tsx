import React, { useState } from 'react';
import { hasCoverImage } from '../../utils/coverImage';
import { NoImage } from './NoImage';

type FadeImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  /** Used if the picture cannot be loaded. */
  fallbackSrc?: string;
};

const DEFAULT_FALLBACK = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80';

/**
 * A photo that fades in when it has loaded. Until then the place it fills shows a skeleton,
 * so put it in a box with a size (the box gets the skeleton look while the photo loads).
 * A recipe without a picture of its own gets the grey Ingen bild vald box instead.
 */
export const FadeImage: React.FC<FadeImageProps> = ({ className = '', fallbackSrc = DEFAULT_FALLBACK, onLoad, onError, ...rest }) => {
  const [loaded, setLoaded] = useState(false);
  if (!hasCoverImage(rest.src)) return <NoImage />;
  return (
    <>
      {!loaded && <span aria-hidden="true" className="skeleton absolute inset-0 block" />}
      <img
        {...rest}
        className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          const el = e.currentTarget;
          if (fallbackSrc && el.src !== fallbackSrc) {
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
