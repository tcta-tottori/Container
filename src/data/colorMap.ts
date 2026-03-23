import { ItemType } from '@/lib/types';

export const COLOR_MAP: Record<ItemType | 'その他', { bg: string; text: string; accent: string }> = {
  'ポリカバー': { bg: '#C8E6C9', text: '#1B5E20', accent: '#4CAF50' },
  'ジャーポット': { bg: '#FFE0B2', text: '#E65100', accent: '#FF9800' },
  '箱': { bg: '#BBDEFB', text: '#0D47A1', accent: '#2196F3' },
  '部品': { bg: '#E1BEE7', text: '#4A148C', accent: '#9C27B0' },
  'その他': { bg: '#F5F5F5', text: '#424242', accent: '#9E9E9E' },
};
