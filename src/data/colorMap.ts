import { ItemType } from '@/lib/types';

export const COLOR_MAP: Record<ItemType | 'その他', {
  bg: string;
  text: string;
  accent: string;
  gradient: string;
  glow: string;
}> = {
  'ポリカバー': {
    bg: '#0a1f0f',
    text: '#a8e6b0',
    accent: '#22c55e',
    gradient: 'linear-gradient(135deg, #0a1f0f 0%, #14532d 100%)',
    glow: 'rgba(34, 197, 94, 0.15)',
  },
  'ジャーポット': {
    bg: '#1a1008',
    text: '#fbbf6e',
    accent: '#f59e0b',
    gradient: 'linear-gradient(135deg, #1a1008 0%, #451a03 100%)',
    glow: 'rgba(245, 158, 11, 0.15)',
  },
  '箱': {
    bg: '#0a1628',
    text: '#93c5fd',
    accent: '#3b82f6',
    gradient: 'linear-gradient(135deg, #0a1628 0%, #1e3a5f 100%)',
    glow: 'rgba(59, 130, 246, 0.15)',
  },
  '部品': {
    bg: '#1a0f28',
    text: '#c4b5fd',
    accent: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #1a0f28 0%, #3b0764 100%)',
    glow: 'rgba(139, 92, 246, 0.15)',
  },
  'その他': {
    bg: '#1a1a1f',
    text: '#a1a1aa',
    accent: '#71717a',
    gradient: 'linear-gradient(135deg, #1a1a1f 0%, #27272a 100%)',
    glow: 'rgba(113, 113, 122, 0.15)',
  },
};
