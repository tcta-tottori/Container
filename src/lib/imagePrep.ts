/**
 * 写真認識の前処理。
 *
 * スマホの写真は 4000px 超・数MB あり、そのまま送ると Gemini の送信が遅い／失敗しやすく、
 * Tesseract も小さい文字を読めない。ここで向き（EXIF）を直し、扱いやすい大きさにそろえる。
 */

/** 画像をデコードする（EXIF の回転を反映）。デコードできない形式（Chrome の HEIC 等）は null */
async function decodeImage(file: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // 下の <img> 経由で再挑戦
    }
  }
  if (typeof document === 'undefined') return null;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sizeOf(img: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if ('naturalWidth' in img) return { w: img.naturalWidth, h: img.naturalHeight };
  return { w: img.width, h: img.height };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

function drawScaled(img: ImageBitmap | HTMLImageElement, w: number, h: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * Gemini 送信用: 長辺を maxSide 以下に縮小した JPEG にする。
 * 失敗したら元のファイルをそのまま返す。
 */
export async function prepareImageForVision(file: File, maxSide = 3072): Promise<Blob> {
  if (typeof document === 'undefined') return file;
  const img = await decodeImage(file);
  if (!img) return file;
  try {
    const { w, h } = sizeOf(img);
    if (!w || !h) return file;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = drawScaled(img, Math.round(w * scale), Math.round(h * scale));
    if (!canvas) return file;
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    return blob || file;
  } finally {
    if ('close' in img) img.close();
  }
}

/**
 * Tesseract 用: グレースケール化＋コントラスト伸張し、文字が読める大きさ（長辺 2400〜3200px）にそろえた PNG。
 * 失敗したら元のファイルをそのまま返す。
 */
export async function prepareImageForOcr(file: File): Promise<Blob> {
  if (typeof document === 'undefined') return file;
  const img = await decodeImage(file);
  if (!img) return file;
  try {
    const { w, h } = sizeOf(img);
    if (!w || !h) return file;
    const long = Math.max(w, h);
    const target = long > 3200 ? 3200 : long < 2400 ? 2400 : long;
    const scale = target / long;
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = drawScaled(img, cw, ch);
    if (!canvas) return file;
    const ctx = canvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, cw, ch);
    const px = data.data;

    // グレースケール＋輝度ヒストグラム
    const hist = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) {
      const g = Math.round(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114);
      px[i] = g;
      hist[g]++;
    }
    // 上下 1% を切ってコントラストを伸ばす（光沢・影で白飛び／黒つぶれ気味の写真対策）
    const total = cw * ch;
    let lo = 0, hi = 255, acc = 0;
    for (; lo < 255; lo++) { acc += hist[lo]; if (acc > total * 0.01) break; }
    acc = 0;
    for (; hi > 0; hi--) { acc += hist[hi]; if (acc > total * 0.01) break; }
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.max(0, Math.min(255, Math.round(((px[i] - lo) * 255) / range)));
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    const blob = await canvasToBlob(canvas, 'image/png');
    return blob || file;
  } finally {
    if ('close' in img) img.close();
  }
}
