import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  interactive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onRatingChange?: (rating: number) => void;
  showText?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  interactive = false,
  size = 'md',
  onRatingChange,
  showText = false,
}) => {
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const buttonSizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  };

  const getRatingLabel = (score: number) => {
    switch (score) {
      case 5:
        return 'Mästerverk';
      case 4:
        return 'Mycket gott';
      case 3:
        return 'Bra';
      case 2:
        return 'Mindre bra';
      case 1:
        return 'Underkänt';
      default:
        return 'Ej betygsatt';
    }
  };

  return (
    <div className="inline-flex items-center gap-1 min-w-0 max-w-full">
      <div className="flex items-center">
        {Array.from({ length: maxRating }, (_, index) => {
          const starValue = index + 1;
          const isFilled = starValue <= rating;

          if (interactive) {
            return (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRatingChange?.(rating === starValue ? 0 : starValue);
                }}
                className={`${buttonSizes[size]} flex items-center justify-center focus:outline-none transition-transform active:scale-125 hover:scale-110 touch-manipulation shrink-0 p-0.5`}
                aria-label={`Sätt betyg ${starValue} av ${maxRating}`}
              >
                <Star
                  className={`${iconSizes[size]} transition-colors duration-150 ${
                    isFilled
                      ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                      : 'text-stone-300 hover:text-amber-300'
                  }`}
                />
              </button>
            );
          }

          return (
            <Star
              key={index}
              className={`${iconSizes[size]} mx-0.5 shrink-0 ${
                isFilled
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-stone-200'
              }`}
            />
          );
        })}
      </div>

      {showText && (
        <span className="text-xs font-semibold text-stone-700 ml-1 truncate">
          {rating > 0 ? getRatingLabel(rating) : 'Tryck för att betygsätta'}
        </span>
      )}
    </div>
  );
};
