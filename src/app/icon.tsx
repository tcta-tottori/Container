import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #2a4dcf 0%, #5b3dbb 30%, #7c3aaf 55%, #c4591e 80%, #e87420 100%)',
        borderRadius: 6,
      }}>
        <svg width="22" height="22" viewBox="0 0 340 320" fill="none">
          <g transform="translate(170,160)">
            <polygon points="0,-140 140,-70 0,0 -140,-70" stroke="white" strokeWidth="24" strokeLinejoin="round" fill="none"/>
            <polygon points="-140,-70 0,0 0,115 -140,45" stroke="white" strokeWidth="24" strokeLinejoin="round" fill="none"/>
            <polygon points="140,-70 0,0 0,115 140,45" stroke="white" strokeWidth="24" strokeLinejoin="round" fill="none"/>
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
