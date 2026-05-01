import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #4a7af7 0%, #6b52d4 35%, #9b45c9 65%, #c0549a 100%)',
        borderRadius: 38,
      }}>
        <svg width="110" height="110" viewBox="0 0 260 260" fill="none">
          <g transform="translate(130,130)">
            <polygon points="0,-95 105,-47 0,0 -105,-47" stroke="white" strokeWidth="20" strokeLinejoin="round" fill="none"/>
            <polygon points="-105,-47 0,0 0,95 -105,47" stroke="white" strokeWidth="20" strokeLinejoin="round" fill="none"/>
            <polygon points="105,-47 0,0 0,95 105,47" stroke="white" strokeWidth="20" strokeLinejoin="round" fill="none"/>
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
