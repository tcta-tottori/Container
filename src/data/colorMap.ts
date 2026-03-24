import { ItemType } from '@/lib/types';

export const COLOR_MAP: Record<ItemType | 'その他', {
  bg: string;
  text: string;
  accent: string;
  gradient: string;
  glow: string;
}> = {
  'ポリカバー': {
    bg: '#f0fdf4',
    text: '#166534',
    accent: '#22c55e',
    gradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    glow: 'rgba(34, 197, 94, 0.1)',
  },
  'ジャーポット': {
    bg: '#fdf2f8',
    text: '#9d174d',
    accent: '#ec4899',
    gradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    glow: 'rgba(236, 72, 153, 0.1)',
  },
  '箱': {
    bg: '#fff7ed',
    text: '#9a3412',
    accent: '#f97316',
    gradient: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
    glow: 'rgba(249, 115, 22, 0.1)',
  },
  '部品': {
    bg: '#faf5ff',
    text: '#6b21a8',
    accent: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)',
    glow: 'rgba(139, 92, 246, 0.1)',
  },
  '鍋': {
    bg: '#fef2f2',
    text: '#991b1b',
    accent: '#ef4444',
    gradient: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
    glow: 'rgba(239, 68, 68, 0.1)',
  },
  'ヤーマン部品': {
    bg: '#fefce8',
    text: '#854d0e',
    accent: '#eab308',
    gradient: 'linear-gradient(135deg, #fefce8 0%, #fef08a 100%)',
    glow: 'rgba(234, 179, 8, 0.1)',
  },
  'その他': {
    bg: '#f9fafb',
    text: '#374151',
    accent: '#6b7280',
    gradient: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
    glow: 'rgba(107, 114, 128, 0.1)',
  },
};
