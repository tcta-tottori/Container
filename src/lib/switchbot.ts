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
  /** 解析元の機種判定（'indoor'=室内, 'outdoor'=防水/屋外） */
  model: 'indoor' | 'outdoor';
  /** デバッグ用: 受信した生バイト（HEX） */
  raw: string;
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

/** byte 配列を HEX 文字列へ（デバッグ用） */
function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface TempHum {
  temperature: number;
  humidity: number;
}

/**
 * 室内モデル（温湿度計 / 温湿度計プラス, WoSensorTH）:
 * 温湿度はサービスデータの byte3,4,5 に格納。
 *   byte3: 下位4bit = 気温の小数第1位
 *   byte4: bit7 = 符号(1で正), 下位7bit = 気温整数部
 *   byte5: 下位7bit = 湿度(%)
 */
function parseIndoor(svc: number[]): TempHum | null {
  if (svc.length < 6) return null;
  const tempFrac = (svc[3] & 0x0f) / 10;
  const tempInt = svc[4] & 0x7f;
  let temperature = tempInt + tempFrac;
  if ((svc[4] & 0x80) === 0) temperature = -temperature;
  const humidity = svc[5] & 0x7f;
  return { temperature: Math.round(temperature * 10) / 10, humidity };
}

/**
 * 防水/屋外モデル（防水温湿度計, WoIOSensorTH）:
 * 温湿度はメーカーデータ側に格納。
 * Web Bluetooth のメーカーデータは先頭のカンパニーID(2byte)を含まない
 * （＝node-switchbot のオフセット9,10,11 がここでは 7,8,9 に対応）。
 *   byte7: 下位4bit = 気温の小数第1位
 *   byte8: bit7 = 符号(1で正), 下位7bit = 気温整数部
 *   byte9: 下位7bit = 湿度(%)
 * 先頭6byteは MAC アドレス。
 */
function parseOutdoor(mfr: number[]): TempHum | null {
  if (mfr.length < 10) return null;
  const tempFrac = (mfr[7] & 0x0f) / 10;
  const tempInt = mfr[8] & 0x7f;
  let temperature = tempInt + tempFrac;
  if ((mfr[8] & 0x80) === 0) temperature = -temperature;
  const humidity = mfr[9] & 0x7f;
  return { temperature: Math.round(temperature * 10) / 10, humidity };
}

/** もっともらしい実測値か（誤読を弾くための緩いチェック） */
function plausible(r: TempHum | null): boolean {
  return !!r && r.humidity > 0 && r.humidity <= 100 && r.temperature >= -30 && r.temperature <= 70;
}

// 機種タイプ（サービスデータ byte0）。屋外/防水は 'w','v'、室内は 'T','i','H'。
const OUTDOOR_TYPES = new Set([0x77, 0x76]);
const INDOOR_TYPES = new Set([0x54, 0x69, 0x48]);

interface ExtractResult {
  temperature: number;
  humidity: number;
  battery: number | null;
  model: 'indoor' | 'outdoor';
  raw: string;
}

/**
 * アドバタイズイベントから温湿度を抽出する。
 * 室内モデル（サービスデータ）と防水/屋外モデル（メーカーデータ）の両方に対応。
 * 機種タイプで優先解析を選び、値がもっともらしい方を採用する。
 */
function extractReading(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any,
): ExtractResult | null {
  // サービスデータ（最初に一致した SwitchBot UUID）
  const serviceData: Map<string, DataView> | undefined = event.serviceData;
  let serviceBytes: number[] | null = null;
  if (serviceData) {
    for (const uuid of SB_SERVICE_UUIDS) {
      const dv = serviceData.get(uuid);
      if (dv) { serviceBytes = toBytes(dv); break; }
    }
  }

  // メーカーデータ（company 0x0969）
  const manufacturerData: Map<number, DataView> | undefined = event.manufacturerData;
  const md = manufacturerData?.get(SB_COMPANY_ID);
  const mfrBytes: number[] | null = md ? toBytes(md) : null;

  if (!serviceBytes && !mfrBytes) return null;

  const deviceType = serviceBytes && serviceBytes.length > 0 ? serviceBytes[0] : null;
  const battRaw = serviceBytes && serviceBytes.length > 2 ? serviceBytes[2] & 0x7f : null;
  const battery = battRaw != null && battRaw > 0 && battRaw <= 100 ? battRaw : null;

  const indoor = serviceBytes ? parseIndoor(serviceBytes) : null;
  const outdoor = mfrBytes ? parseOutdoor(mfrBytes) : null;

  // 機種タイプで優先順を決定（不明時は屋外→室内の順で試す）
  let ordered: Array<{ r: TempHum | null; model: 'indoor' | 'outdoor' }>;
  if (deviceType != null && OUTDOOR_TYPES.has(deviceType)) {
    ordered = [{ r: outdoor, model: 'outdoor' }, { r: indoor, model: 'indoor' }];
  } else if (deviceType != null && INDOOR_TYPES.has(deviceType)) {
    ordered = [{ r: indoor, model: 'indoor' }, { r: outdoor, model: 'outdoor' }];
  } else {
    ordered = [{ r: outdoor, model: 'outdoor' }, { r: indoor, model: 'indoor' }];
  }

  // もっともらしい値を優先、無ければ非nullを採用
  const pick = ordered.find((o) => plausible(o.r)) || ordered.find((o) => o.r);
  if (!pick || !pick.r) return null;

  const raw =
    `type:${deviceType != null ? '0x' + deviceType.toString(16) : '--'} ` +
    `svc:${serviceBytes ? toHex(serviceBytes) : '--'} ` +
    `mfr:${mfrBytes ? toHex(mfrBytes) : '--'}`;

  // デバッグ用に生バイトを出力（解析仕様の検証に使える）
  if (typeof console !== 'undefined') {
    console.debug('[SwitchBot]', raw, '=>', pick.model, pick.r);
  }

  return {
    temperature: pick.r.temperature,
    humidity: pick.r.humidity,
    battery,
    model: pick.model,
    raw,
  };
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
      model: parsed.model,
      raw: parsed.raw,
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
