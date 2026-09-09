import React, { useEffect, useState, useRef } from 'react';

interface Props {
  onComplete?: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<Props> = ({
  onComplete,
  durationMs = 2800
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const handleSkip = () => {
    setIsFadingOut(true);
    if (onCompleteRef.current) {
      onCompleteRef.current();
    }
  };

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, Math.max(0, durationMs - 450));

    const completeTimer = setTimeout(() => {
      if (onCompleteRef.current) {
        onCompleteRef.current();
      }
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [durationMs]);

  return (
    <div
      onClick={handleSkip}
      className={`lifeline-splash-container ${isFadingOut ? 'splash-fade-out' : ''}`}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9999,
        background: '#040711',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '50px 24px 36px 24px',
        overflow: 'hidden',
        color: '#FFF',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
        cursor: 'pointer'
      }}
      title="Tap to continue"
    >
      {/* Background Starfield Particles */}
      <div className="splash-stars-bg" />

      {/* Atmospheric Aurora / Blue Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '380px',
          height: '240px',
          background: 'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.14) 0%, rgba(239, 68, 68, 0.05) 50%, transparent 80%)',
          filter: 'blur(32px)',
          pointerEvents: 'none'
        }}
      />

      {/* Top spacer for balanced composition */}
      <div style={{ height: 20 }} />

      {/* Center Hero Block: Futuristic Wireless Emergency Beacon + Branding */}
      <div
        className="splash-hero-block"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 10,
          marginTop: 'auto',
          marginBottom: 'auto'
        }}
      >
        {/* Futuristic Wireless / Emergency Signal Icon */}
        <div className="splash-icon-wrapper" style={{ position: 'relative', marginBottom: 28 }}>
          {/* Animated Ambient Beacon Wave Rings */}
          <div className="splash-beacon-wave wave-1" />
          <div className="splash-beacon-wave wave-2" />
          <div className="splash-beacon-wave wave-3" />

          {/* Central Glowing Icon Emblem */}
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '26px',
              background: 'linear-gradient(145deg, #182238, #0B101D)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              boxShadow: '0 0 35px rgba(239, 68, 68, 0.35), 0 0 15px rgba(56, 189, 248, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 5
            }}
          >
            {/* Custom SVG Emergency Wireless Mesh Transmitter Symbol */}
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))' }}
            >
              {/* Outer Radio Transmission Arcs */}
              <path
                d="M8 16C12.4 11.6 18.5 9 24 9C29.5 9 35.6 11.6 40 16"
                stroke="#EF4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="beacon-arc-outer"
              />
              <path
                d="M13 21C16 18 19.8 16 24 16C28.2 16 32 18 35 21"
                stroke="#F87171"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="beacon-arc-mid"
              />
              <path
                d="M18 26C19.6 24.4 21.7 23.5 24 23.5C26.3 23.5 28.4 24.4 30 26"
                stroke="#FCA5A5"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="beacon-arc-inner"
              />

              {/* Central Glowing Emergency Diamond Beacon */}
              <circle cx="24" cy="33" r="4.5" fill="#EF4444" />
              <circle cx="24" cy="33" r="2" fill="#FFFFFF" />

              {/* Vertical Transmission Stem */}
              <line x1="24" y1="37" x2="24" y2="42" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="24" cy="43" r="1.5" fill="#38BDF8" />
            </svg>
          </div>
        </div>

        {/* Brand Name: LIFELINE */}
        <h1
          style={{
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: '5px',
            color: '#FFFFFF',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            textShadow: '0 0 25px rgba(255, 255, 255, 0.4), 0 0 45px rgba(56, 189, 248, 0.3)'
          }}
        >
          LIFELINE
        </h1>

        {/* Subtitle: OFFLINE COMMUNICATION & RESCUE NETWORK */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '2.5px',
            color: '#94A3B8',
            lineHeight: 1.6,
            textTransform: 'uppercase'
          }}
        >
          OFFLINE COMMUNICATION<br />
          <span style={{ color: '#38BDF8', letterSpacing: '3px' }}>& RESCUE NETWORK</span>
        </div>
      </div>

      {/* Lower-Middle Section: Value Proposition & Spinner */}
      <div
        className="splash-lower-section"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 10,
          marginBottom: 20
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            marginBottom: 24
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '1px', color: '#E2E8F0' }}>
            Stay Connected
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '1px', color: '#38BDF8' }}>
            Stay Safe
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '1px', color: '#EF4444' }}>
            Anywhere
          </span>
        </div>

        {/* Subtle Glowing Blue/White Loading Spinner */}
        <div className="splash-loading-spinner">
          <div className="spinner-core" />
        </div>
      </div>

      {/* Earth Curvature / Horizon Glow near bottom */}
      <div className="splash-earth-curvature">
        <div className="earth-atmosphere-glow" />
        <div className="earth-body" />
      </div>
    </div>
  );
};
