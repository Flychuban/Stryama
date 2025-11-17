import { ImageResponse } from 'next/og';

// Image metadata
export const alt = 'Stryama - AI-Powered App Builder';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          position: 'relative',
        }}
      >
        {/* Animated gradient overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(139,92,246,0.3) 0%, transparent 50%)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          {/* Logo placeholder - using text since we can't easily load PNG in ImageResponse */}
          <div
            style={{
              fontSize: 120,
              fontWeight: 'bold',
              color: 'white',
              marginBottom: 20,
              letterSpacing: -4,
              textShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            Stryama
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 42,
              color: 'rgba(255,255,255,0.95)',
              textAlign: 'center',
              maxWidth: 900,
              lineHeight: 1.3,
              fontWeight: 600,
            }}
          >
            AI-Powered App Builder
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 28,
              color: 'rgba(255,255,255,0.85)',
              textAlign: 'center',
              marginTop: 16,
              maxWidth: 800,
            }}
          >
            Build apps in under 2 minutes • No coding required
          </div>

          {/* Powered by badge */}
          <div
            style={{
              fontSize: 20,
              color: 'rgba(255,255,255,0.7)',
              marginTop: 32,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '12px 24px',
              borderRadius: 50,
              backdropFilter: 'blur(10px)',
            }}
          >
            ✨ Powered by Claude AI
          </div>
        </div>

        {/* Bottom decoration */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 18,
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          stryama.app
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
