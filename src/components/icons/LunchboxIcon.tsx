import React from 'react';

interface LunchboxIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const LunchboxIcon: React.FC<LunchboxIconProps> = ({
  size,
  className = 'w-4 h-4',
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <rect width="20" height="15" x="2" y="7" rx="3" />
      <path d="M9 7V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3" />
      <path d="M2 12h20" />
      <path d="M10 12v3" />
      <path d="M14 12v3" />
    </svg>
  );
};

export default LunchboxIcon;
