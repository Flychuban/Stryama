import Image from 'next/image';

type LogoProps = {
  size?: number;
  className?: string;
  showText?: boolean;
  variant?: 'default' | 'white' | 'dark';
  withContainer?: boolean;
  containerVariant?: 'subtle' | 'glass';
};

export function Logo({
  size = 32,
  className = '',
  showText = true,
  variant = 'default',
  withContainer = false,
  containerVariant = 'subtle',
}: LogoProps) {
  const iconSize = size;

  // Container styles based on variant
  const containerStyles = withContainer
    ? containerVariant === 'glass'
      ? 'bg-white/80 dark:bg-background/80 backdrop-blur-sm rounded-lg p-1.5'
      : 'bg-background border border-border/20 rounded-xl p-2.5 shadow-sm'
    : '';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Logo Icon */}
      <div className={containerStyles}>
        <div
          className="relative flex-shrink-0"
          style={{
            width: iconSize,
            height: iconSize,
          }}
        >
          <Image
            src="/logo/stryama-logo-transparent.png"
            alt="Stryama Logo"
            width={iconSize}
            height={iconSize}
            className="h-full w-full object-contain"
            priority
          />
        </div>
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
