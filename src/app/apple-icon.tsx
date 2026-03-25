import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #2a4dcf 0%, #5b3dbb 30%, #7c3aaf 55%, #c4591e 80%, #e87420 100%)',
        borderRadius: 32,
      }}>
        <svg width="120" height="120" viewBox="0 0 340 320" fill="none">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feFlood floodColor="#8ab4ff" floodOpacity="0.7" result="color"/>
              <feComposite in="color" in2="blur" operator="in" result="g1"/>
              <feMerge>
                <feMergeNode in="g1"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <g transform="translate(170,160)" filter="url(#glow)">
            <polygon points="0,-140 140,-70 0,0 -140,-70" stroke="white" strokeWidth="20" strokeLinejoin="round" fill="none"/>
            <polygon points="-140,-70 0,0 0,115 -140,45" stroke="white" strokeWidth="20" strokeLinejoin="round" fill="none"/>
            <polygon points="140,-70 0,0 0,115 140,45" stroke="white" strokeWidth="20" strokeLinejoin="round" fill="none"/>
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
