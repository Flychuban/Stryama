interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  variant?: 'default' | 'white' | 'dark';
}

export function Logo({
  size = 32,
  className = '',
  showText = true,
  variant = 'default',
}: LogoProps) {
  const iconSize = size;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Icon - Abstract geometric shape suggesting building blocks and AI */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient
            id="logo-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop
              offset="0%"
              className="text-primary"
              stopColor="currentColor"
            />
            <stop
              offset="100%"
              className="text-accent"
              stopColor="currentColor"
            />
          </linearGradient>
          <linearGradient
            id="logo-gradient-white"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="white" stopOpacity="0.95" />
            <stop offset="100%" stopColor="white" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Main geometric shape - three interlocking blocks forming an S */}
        <g
          fill={
            variant === 'white'
              ? 'url(#logo-gradient-white)'
              : 'url(#logo-gradient)'
          }
        >
          {/* Top block */}
          <path d="M8 4 L20 4 L20 12 L16 16 L8 16 Z" opacity="0.9" />
          {/* Middle block - creates the S curve */}
          <path d="M16 12 L28 12 L28 20 L24 24 L16 24 Z" opacity="0.95" />
          {/* Bottom block */}
          <path d="M12 20 L24 20 L24 28 L20 32 L12 32 Z" opacity="1" />
          {/* Accent dots - AI/tech element */}
          <circle cx="32" cy="8" r="2" opacity="0.8" />
          <circle cx="36" cy="12" r="1.5" opacity="0.6" />
          <circle cx="4" cy="28" r="2" opacity="0.8" />
          <circle cx="8" cy="32" r="1.5" opacity="0.6" />
        </g>
      </svg>

      {/* Text */}
      {showText && (
        <span
          className={`font-bold tracking-tight ${
            size > 32 ? 'text-2xl' : 'text-xl'
          } ${
            variant === 'white'
              ? 'text-white'
              : variant === 'dark'
                ? 'text-foreground'
                : 'from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-transparent'
          }`}
          style={{ fontSize: size > 32 ? size * 0.6 : size * 0.55 }}
        >
          Stryama
        </span>
      )}
    </div>
  );
}
