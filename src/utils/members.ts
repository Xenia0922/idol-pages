export interface MemberMeta { emoji: string; name: string; color: string; }
export const MEMBER_META: Record<string, MemberMeta> = {
  'member-a': { emoji: '💗', name: '成员A', color: '#C94D7A' },
  'member-b': { emoji: '💙', name: '成员B', color: '#2F6FED' },
  'member-c': { emoji: '💚', name: '成员C', color: '#1E9E6A' },
  other:      { emoji: '⭐', name: '多人·其他', color: '#C2417A' },
};
export function tint(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
