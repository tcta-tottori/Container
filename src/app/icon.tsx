import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, position: 'relative', overflow: 'hidden',
        background: '#0e0b1a',
      }}>
        {/* 乱雑に混ざり合うグラデーション（青・紫・オレンジ） */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          background: 'radial-gradient(circle at 15% 25%, #3b6ef6 0%, transparent 50%), radial-gradient(circle at 75% 20%, #7c48d0 0%, transparent 45%), radial-gradient(circle at 60% 80%, #e87420 0%, transparent 50%), radial-gradient(circle at 30% 70%, #3b6ef6 0%, transparent 40%), radial-gradient(circle at 85% 65%, #9b30ff 0%, transparent 45%)',
        }} />
        <svg width="20" height="20" viewBox="0 0 260 260" fill="none">
          <g transform="translate(130,130)">
            <polygon points="0,-100 110,-50 0,0 -110,-50" stroke="white" strokeWidth="20" strokeLinejoin="round" fill="none"/>
            <polygon points="-110,-50 0,0 0,100 -110,50" stroke="white" strokeWidth="20" strokeLinejoin="round" fill="none"/>
            <polygon points="110,-50 0,0 0,100 110,50" stroke="white" strokeWidth="20" strokeLinejoin="round" fill="none"/>
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
