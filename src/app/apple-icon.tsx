import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 32, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #3b6ef6 0%, #e87420 20%, #7c48d0 45%, #3b6ef6 65%, #e87420 85%, #7c48d0 100%)',
        }} />
        <svg width="110" height="110" viewBox="0 0 260 260" fill="none" style={{ position: 'relative' }}>
          <g transform="translate(130,130)">
            <polygon points="0,-100 110,-50 0,0 -110,-50" stroke="white" strokeWidth="16" strokeLinejoin="round" fill="none"/>
            <polygon points="-110,-50 0,0 0,100 -110,50" stroke="white" strokeWidth="16" strokeLinejoin="round" fill="none"/>
            <polygon points="110,-50 0,0 0,100 110,50" stroke="white" strokeWidth="16" strokeLinejoin="round" fill="none"/>
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
