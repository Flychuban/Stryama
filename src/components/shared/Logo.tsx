type LogoProps = {
  size?: number;
  className?: string;
  showText?: boolean;
  variant?: 'default' | 'white' | 'dark';
};

export function Logo({
  size = 32,
  className = '',
  showText = true,
  variant = 'default',
}: LogoProps) {
  const iconSize = size;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Simple placeholder icon - easy to replace */}
      <div
        className={`flex items-center justify-center rounded-lg font-bold ${
          variant === 'white'
            ? 'bg-white/10 text-white'
            : 'bg-primary/10 text-primary'
        }`}
        style={{
          width: iconSize,
          height: iconSize,
          fontSize: iconSize * 0.5,
        }}
      >
        S
      </div>

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
                : 'text-foreground'
          }`}
          style={{ fontSize: size > 32 ? size * 0.6 : size * 0.55 }}
        >
          Stryama
        </span>
      )}
    </div>
  );
}
