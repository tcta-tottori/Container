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
  '箱': {
    bg: '#eff6ff',
    text: '#1e40af',
    accent: '#3b82f6',
    gradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    glow: 'rgba(59, 130, 246, 0.1)',
  },
  '部品': {
    bg: '#faf5ff',
    text: '#6b21a8',
    accent: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)',
    glow: 'rgba(139, 92, 246, 0.1)',
  },
  'その他': {
    bg: '#f9fafb',
    text: '#374151',
    accent: '#6b7280',
    gradient: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
    glow: 'rgba(107, 114, 128, 0.1)',
  },
};
