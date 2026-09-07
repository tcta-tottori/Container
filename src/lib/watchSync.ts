/**
 * Pixel Watch（Wear OS）への同期。
 *
 * CNS を Android アプリ（android/mobile、WebView）で開いているとき、
 * アプリが `window.CNSWatch` という橋渡しを用意する。
 * ここでは CNS の作業状態を android/shared の `ContainerSyncPayload` と同じ形の JSON にして
 * その橋渡しに渡す。アプリ側は Wearable Data Layer API でウォッチへ送る。
 *
 * ブラウザで開いているとき（橋渡しが無いとき）は何もしない。
 */
import { Container, ContainerItem } from './types';
import { displayQuantities } from './itemQuantity';
import { areSimilarItems } from './typeDetector';
import { summarizeLoad } from './containerLoad';
import { buildJapanesePartName } from './partTranslations';

/**
 * ウォッチに出す品名。スマホの一覧・カードと同じ決め方にする
 * （日本語の部品名があればそれ、無ければ「ポリカバー」を落とした品名）。
 */
function displayName(item: ContainerItem): string {
  const jp = buildJapanesePartName(item);
  if (jp) return jp;
  return item.itemName.replace(/ポリカバー/g, '').replace(/^[\s\-]+|[\s\-]+$/g, '') || item.itemName;
}

/** android/shared の ContainerInfo と同じ形 */
export interface WatchContainerInfo {
  id: string;
  name: string;
  containerType: string;
  loadPercentage: number;
  remainingPercentage: number;
  totalQuantity: number;
  itemCount: number;
  status: string;
  updatedAt: number;
  totalPallets: number;
  totalCartons: number;
  startedAt?: number;
  pausedAt?: number;
}

/** android/shared の CargoItem と同じ形 */
export interface WatchCargoItem {
  id: string;
  name: string;
  quantity: number;
  palletCount: number;
  cartonCount: number;
  itemType?: string;
  modelName?: string;
  remainingPercentage?: number;
  warning?: string;
  /** 1パレットあたりのケース数（ウォッチで端数パレットの積み方を描くのに使う） */
  qtyPerPallet?: number;
  /** 1ケースの外寸 "55*38*38"（cm）。同上 */
  measurements?: string;
  location?: string;
  status?: string;
}

/** android/shared の ContainerSyncPayload と同じ形 */
export interface WatchSyncPayload {
  schemaVersion: number;
  generatedAt: number;
  selectedContainerId: string | null;
  containers: WatchContainerInfo[];
  cargo: Record<string, WatchCargoItem[]>;
  environment?: { temperatureC: number; humidityPercent: number; measuredAt: number };
}

/** 品目の元の数（useContainerData の OriginalValues と同じ形） */
export interface WatchOriginalValues {
  totalQty: number;
  palletCount: number;
  caseCount: number;
}

export interface WatchSyncInput {
  containers: Container[];
  selectedContainerIdx: number;
  /** 選択中コンテナの作業用品目（パレット減算が反映されたもの） */
  items: ContainerItem[];
  currentItemIdx: number;
  originalValues: Map<string, WatchOriginalValues>;
  completedIds: Set<string>;
  workStartTime: number | null;
  workPausedAt: number | null;
  climate: { temperature: number; humidity: number } | null;
  /** 作業ページを開いているか。開いた時点でウォッチへ「荷降ろし中」として知らせる */
  workViewOpen?: boolean;
}

/** ウォッチから届く操作 */
export interface WatchCommand {
  /** 'selectItem' | 'decrementPallet' | 'incrementPallet' | 'uncompleteItem' | 'call' */
  type: string;
  /** 対象の品目 ID */
  itemId: string;
  /** 対象のコンテナ ID */
  containerId?: string;
  /** ウォッチで操作した時刻 */
  issuedAt?: number;
  /** 'call' のときにどのコールか（'request' | 'name' | 'cheer' | 'item'） */
  arg?: string;
}

/** Android アプリが用意する橋渡し */
interface CNSWatchBridge {
  postSync(json: string): void;
  isAvailable(): boolean;
}

declare global {
  interface Window {
    CNSWatch?: CNSWatchBridge;
    /** アプリがウォッチからの操作を渡してくる入口 */
    CNSWatchCommand?: (json: string) => void;
  }
}

/** Android アプリ（WebView）の中で動いていて、ウォッチへ送れるか */
export function isWatchBridgeAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = window.CNSWatch;
  if (!bridge) return false;
  try {
    return typeof bridge.postSync === 'function' && (typeof bridge.isAvailable !== 'function' || bridge.isAvailable());
  } catch {
    return false;
  }
}

/** 残りケース数（パレット × 1パレットのケース数 + 端数） */
function cartonsOf(palletCount: number, item: ContainerItem): number {
  return Math.max(0, palletCount * (item.qtyPerPallet || 0) + Math.ceil(item.fraction || 0));
}

function containerId(c: Container): string {
  return c.date ? `${c.date}_${c.containerNo}` : c.containerNo;
}

function pct(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

/** 選択中コンテナの品目を、作業状態込みでウォッチ用に変換する */
function buildWorkingItems(input: WatchSyncInput): WatchCargoItem[] {
  const { items, currentItemIdx, originalValues, completedIds } = input;
  return items.map((item, idx) => {
    const completed = completedIds.has(item.id);
    const original = originalValues.get(item.id);
    const originalCartons = original ? cartonsOf(original.palletCount, item) : cartonsOf(item.palletCount, item);
    const remainingCartons = completed ? 0 : cartonsOf(item.palletCount, item);
    const q = displayQuantities(item);
    const similar = item.type === '鍋'
      ? []
      : items.filter((o) => o.id !== item.id && areSimilarItems(item.itemName, o.itemName));
    return {
      id: item.id,
      name: item.itemName,
      quantity: completed ? 0 : Math.max(0, Math.ceil(item.totalQty)),
      palletCount: completed ? 0 : q.pallets,
      cartonCount: completed ? 0 : q.cartons,
      itemType: item.type,
      modelName: displayName(item),
      remainingPercentage: completed ? 0 : originalCartons > 0 ? pct((remainingCartons / originalCartons) * 100) : 100,
      warning: similar.length > 0 ? `類似品: ${similar.map((s) => s.itemName).join('、')}` : undefined,
      qtyPerPallet: item.qtyPerPallet || undefined,
      measurements: item.measurements || undefined,
      location: item.partNumber || undefined,
      status: completed ? '完了' : idx === currentItemIdx ? '作業中' : '未着手',
    };
  });
}

/** 未着手のコンテナ（Excel の値そのまま） */
function buildPlainItems(items: ContainerItem[]): WatchCargoItem[] {
  return items.map((item) => {
    const q = displayQuantities(item);
    return {
      id: item.id,
      name: item.itemName,
      quantity: Math.max(0, Math.ceil(item.totalQty)),
      palletCount: q.pallets,
      cartonCount: q.cartons,
      itemType: item.type,
      modelName: displayName(item),
      remainingPercentage: 100,
      qtyPerPallet: item.qtyPerPallet || undefined,
      measurements: item.measurements || undefined,
      location: item.partNumber || undefined,
      status: '未着手',
    };
  });
}

function buildContainerInfo(
  c: Container,
  cargo: WatchCargoItem[],
  sourceItems: ContainerItem[],
  opts: { selected: boolean; input: WatchSyncInput; now: number },
): WatchContainerInfo {
  const { selected, input, now } = opts;
  const completedIds = selected ? input.completedIds : new Set<string>();
  const load = summarizeLoad(sourceItems, completedIds);

  // 積載率は「まだ降ろしていないケース数 ÷ 元のケース数」
  let originalCartons = 0;
  let remainingCartons = 0;
  for (const item of sourceItems) {
    const original = selected ? input.originalValues.get(item.id) : undefined;
    originalCartons += cartonsOf(original ? original.palletCount : item.palletCount, item);
    if (!(selected && completedIds.has(item.id))) remainingCartons += cartonsOf(item.palletCount, item);
  }
  const loadPercentage = originalCartons > 0 ? pct((remainingCartons / originalCartons) * 100) : 0;

  const allDone = cargo.length > 0 && cargo.every((it) => it.status === '完了');
  const status = !selected
    ? '荷降ろし待ち'
    : allDone
      ? '完了'
      : input.workPausedAt !== null
        ? '一時停止'
        : input.workStartTime !== null || input.workViewOpen
          ? '荷降ろし中'
          : '荷降ろし待ち';

  const active = cargo.filter((it) => it.status !== '完了');
  return {
    id: containerId(c),
    name: c.containerNo,
    containerType: load.spec.name,
    loadPercentage,
    remainingPercentage: pct(100 - loadPercentage),
    totalQuantity: active.reduce((sum, it) => sum + it.quantity, 0),
    itemCount: cargo.length,
    status,
    updatedAt: now,
    totalPallets: active.reduce((sum, it) => sum + it.palletCount, 0),
    totalCartons: active.reduce((sum, it) => sum + it.cartonCount, 0),
    startedAt: selected && input.workStartTime !== null ? input.workStartTime : undefined,
    pausedAt: selected && input.workPausedAt !== null ? input.workPausedAt : undefined,
  };
}

/** CNS の作業状態からウォッチへ送る JSON（オブジェクト）を組み立てる */
export function buildWatchPayload(input: WatchSyncInput, now: number = Date.now()): WatchSyncPayload {
  const containers: WatchContainerInfo[] = [];
  const cargo: Record<string, WatchCargoItem[]> = {};
  let selectedContainerId: string | null = null;

  input.containers.forEach((c, idx) => {
    const selected = idx === input.selectedContainerIdx;
    const sourceItems = selected ? input.items : c.items;
    const items = selected ? buildWorkingItems(input) : buildPlainItems(c.items);
    const info = buildContainerInfo(c, items, sourceItems, { selected, input, now });
    containers.push(info);
    cargo[info.id] = items;
    if (selected) selectedContainerId = info.id;
  });

  const payload: WatchSyncPayload = {
    schemaVersion: 1,
    generatedAt: now,
    selectedContainerId,
    containers,
    cargo,
  };
  if (input.climate && isFinite(input.climate.temperature) && isFinite(input.climate.humidity)) {
    payload.environment = {
      temperatureC: Math.round(input.climate.temperature * 10) / 10,
      humidityPercent: Math.round(input.climate.humidity),
      measuredAt: now,
    };
  }
  return payload;
}

/** 時刻を除いた内容の署名。同じ内容を何度も送らないために使う */
function signatureOf(payload: WatchSyncPayload): string {
  const { generatedAt: _g, ...rest } = payload;
  void _g;
  return JSON.stringify({
    ...rest,
    containers: rest.containers.map(({ updatedAt: _u, ...c }) => { void _u; return c; }),
    environment: rest.environment ? { t: rest.environment.temperatureC, h: rest.environment.humidityPercent } : null,
  });
}

let lastSignature = '';
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let pendingInput: WatchSyncInput | null = null;

/** 実際に橋渡しへ渡す */
function flush(): void {
  pendingTimer = null;
  const input = pendingInput;
  pendingInput = null;
  if (!input || !isWatchBridgeAvailable()) return;
  const payload = buildWatchPayload(input);
  const signature = signatureOf(payload);
  if (signature === lastSignature) return;
  lastSignature = signature;
  try {
    window.CNSWatch!.postSync(JSON.stringify(payload));
  } catch (e) {
    console.warn('watch sync failed', e);
  }
}

/**
 * ウォッチへ同期する。短い間隔の連続変更は 300ms まとめて 1 回にする。
 * 橋渡しが無い（ブラウザで開いている）ときは何もしない。
 */
export function syncToWatch(input: WatchSyncInput): void {
  if (!isWatchBridgeAvailable()) return;
  pendingInput = input;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(flush, 300);
}

/**
 * ウォッチからの操作を受け取る係を登録する。
 * アプリ（WebView）の中でだけ呼ばれる。null を渡すと解除。
 */
export function setWatchCommandHandler(handler: ((command: WatchCommand) => void) | null): void {
  if (typeof window === 'undefined') return;
  if (!handler) {
    delete window.CNSWatchCommand;
    return;
  }
  window.CNSWatchCommand = (json: string) => {
    let command: WatchCommand;
    try {
      command = JSON.parse(json) as WatchCommand;
    } catch {
      console.warn('watch command parse failed');
      return;
    }
    if (!command || typeof command.type !== 'string' || typeof command.itemId !== 'string') return;
    handler(command);
  };
}
