'use client';

/**
 * SwitchBot 温湿度計（Bluetooth）連携
 * ------------------------------------------------------------------
 * SwitchBot 温湿度計は BLE アドバタイズ（ブロードキャスト）で温度・湿度を
 * 常時発信している。これを Web Bluetooth の LE スキャン
 * （navigator.bluetooth.requestLEScan）で受信して解析する。
 *
 * ※ requestLEScan は Chrome の実験的機能。Android Chrome で
 *   chrome://flags/#enable-experimental-web-platform-features を有効にすると使える。
 *   ペアリング不要で、受信のたびに最新値が更新されるため常時表示バーに向いている。
 *
 * 解析仕様は node-switchbot / python 実装で公開されている
 * WoSensorTH（Meter / Meter Plus / Outdoor Meter）のサービスデータ形式に準拠。
 */

import { computeWBGT } from './weatherNews';

export interface SwitchBotReading {
  /** 気温 (℃) */
  temperature: number;
  /** 相対湿度 (%) */
  humidity: number;
  /** 暑さ指数 WBGT（気温・湿度からの推定値, ℃） */
  wbgt: number;
  /** 電池残量 (%)。取得できない場合 null */
  battery: number | null;
  /** 電波強度 RSSI (dBm)。取得できない場合 null */
  rssi: number | null;
  /** デバイス名（取得できる場合） */
  deviceName: string | null;
  /** 受信時刻 (epoch ms) */
  updatedAt: number;
}

export type SwitchBotScanState = 'scanning' | 'stopped' | 'error';

// SwitchBot がサービスデータを載せる UUID（Web Bluetooth が返す 128bit 正規形）
const SB_SERVICE_UUIDS = [
  '0000fd3d-0000-1000-8000-00805f9b34fb', // 現行 SwitchBot カンパニーサービス
  '00000d00-0000-1000-8000-00805f9b34fb', // 旧 Meter サービス
  'cba20d00-224d-11e6-9fb8-0002a5d5c51b', // カスタムサービス（一部ファーム）
];

// SwitchBot（Woan Technology）の Bluetooth カンパニー ID
const SB_COMPANY_ID = 0x0969;

/** DataView を通常の byte 配列へ */
function toBytes(dv: DataView): number[] {
  const out: number[] = [];
  for (let i = 0; i < dv.byteLength; i++) out.push(dv.getUint8(i));
  return out;
}

/**
 * 温湿度の 3 バイト組を解析する。
 * SwitchBot Meter のサービスデータでは
 *   fracByte: 下位4bit = 気温の小数第1位
 *   intByte : bit7 = 符号(1で正), 下位7bit = 気温整数部
 *   humByte : 下位7bit = 湿度(%)
 */
function parseTriplet(
  fracByte: number,
  intByte: number,
  humByte: number,
): { temperature: number; humidity: number } | null {
  const tempFrac = (fracByte & 0x0f) / 10;
  const tempInt = intByte & 0x7f;
  let temperature = tempInt + tempFrac;
  const positive = (intByte & 0x80) !== 0;
  if (!positive) temperature = -temperature;
  const humidity = humByte & 0x7f;

  // 妥当性チェック（誤検出を弾く）
  if (humidity < 0 || humidity > 100) return null;
  if (temperature < -40 || temperature > 90) return null;

  return { temperature: Math.round(temperature * 10) / 10, humidity };
}

/** サービスデータ（device type + status + battery + temp/hum...）を解析 */
function parseServiceData(
  bytes: number[],
): { temperature: number; humidity: number; battery: number | null } | null {
  if (bytes.length < 6) return null;
  const th = parseTriplet(bytes[3], bytes[4], bytes[5]);
  if (!th) return null;
  const battery = bytes[2] & 0x7f;
  return { ...th, battery: battery <= 100 ? battery : null };
}

/**
 * アドバタイズイベントから温湿度を抽出する。
 * まずサービスデータ、無ければメーカーデータ（MAC 6byte の後ろ）を試す。
 * 解析できない場合、後で調整できるよう生バイトを console.debug に出す。
 */
function extractReading(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any,
): { temperature: number; humidity: number; battery: number | null } | null {
  // 1) サービスデータ
  const serviceData: Map<string, DataView> | undefined = event.serviceData;
  if (serviceData) {
    for (const uuid of SB_SERVICE_UUIDS) {
      const dv = serviceData.get(uuid);
      if (dv) {
        const parsed = parseServiceData(toBytes(dv));
        if (parsed) return parsed;
      }
    }
  }

  // 2) メーカーデータ（company 0x0969）: [6byte MAC][payload...]
  //    payload はサービスデータと同形式のことが多いので MAC を除いた先頭から解析。
  const manufacturerData: Map<number, DataView> | undefined = event.manufacturerData;
  const md = manufacturerData?.get(SB_COMPANY_ID);
  if (md) {
    const bytes = toBytes(md);
    // 先頭 6byte は MAC アドレス。以降を device data とみなす。
    const payload = bytes.length > 6 ? bytes.slice(6) : bytes;
    const parsed = parseServiceData(payload);
    if (parsed) return parsed;
    // デバッグ用に生バイトを出しておく（解析仕様の微調整に使える）
    if (typeof console !== 'undefined') {
      console.debug('[SwitchBot] 未解析のメーカーデータ', bytes);
    }
  }

  return null;
}

/** この端末/ブラウザが BLE スキャンに対応しているか */
export function isSwitchBotScanSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(navigator as any).bluetooth?.requestLEScan
  );
}

/**
 * SwitchBot 温湿度計のスキャンを開始する。
 * @param onReading 値を受信するたびに呼ばれる
 * @param onState   スキャン状態が変化したときに呼ばれる
 * @returns スキャンを停止する関数
 */
export async function startSwitchBotScan(
  onReading: (reading: SwitchBotReading) => void,
  onState?: (state: SwitchBotScanState, error?: string) => void,
): Promise<() => void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bt = (navigator as any).bluetooth;
  if (!bt?.requestLEScan) {
    throw new Error('この端末・ブラウザは Bluetooth スキャンに対応していません');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (event: any) => {
    const parsed = extractReading(event);
    if (!parsed) return;
    onReading({
      temperature: parsed.temperature,
      humidity: parsed.humidity,
      wbgt: computeWBGT(parsed.temperature, parsed.humidity),
      battery: parsed.battery,
      rssi: typeof event.rssi === 'number' ? event.rssi : null,
      deviceName: event.device?.name ?? null,
      updatedAt: Date.now(),
    });
  };

  bt.addEventListener('advertisementreceived', handler);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scan: any;
  try {
    // acceptAllAdvertisements で全アドバタイズを受信し、handler 側で SwitchBot を選別。
    scan = await bt.requestLEScan({
      acceptAllAdvertisements: true,
      keepRepeatedDevices: true,
    });
  } catch (e) {
    bt.removeEventListener('advertisementreceived', handler);
    const msg = e instanceof Error ? e.message : String(e);
    onState?.('error', msg);
    throw e;
  }

  onState?.('scanning');

  return () => {
    try {
      scan?.stop?.();
    } catch {
      /* ignore */
    }
    bt.removeEventListener('advertisementreceived', handler);
    onState?.('stopped');
  };
}
