import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #3b6ef6 0%, #7c48d0 40%, #e87420 100%)',
        borderRadius: 32,
      }}>
        <svg width="120" height="120" viewBox="0 0 260 260" fill="none">
          <g transform="translate(130,130)">
            <polygon points="0,-100 110,-50 0,0 -110,-50" stroke="white" strokeWidth="22" strokeLinejoin="round" fill="none"/>
            <polygon points="-110,-50 0,0 0,100 -110,50" stroke="white" strokeWidth="22" strokeLinejoin="round" fill="none"/>
            <polygon points="110,-50 0,0 0,100 110,50" stroke="white" strokeWidth="22" strokeLinejoin="round" fill="none"/>
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
