export interface MemberMeta {
  emoji: string;
  name: string;
  color: string;
}
export const MEMBER_META: Record<string, MemberMeta> = {
  "member-a": { emoji: "💗", name: "成员A", color: "#FF6B9D" },
  "member-b": { emoji: "💙", name: "成员B", color: "#4DA6FF" },
  "member-c": { emoji: "💚", name: "成员C", color: "#48D1A0" },
  other: { emoji: "⭐", name: "多人·其他", color: "#C2417A" },
};
export function tint(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
