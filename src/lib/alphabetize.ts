export type Entry = {
  id: string;
  username: string;
  // ...add any other fields you render
};

export const LETTERS = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i)
);
export const GROUPS_ORDER = [...LETTERS, "#"];

export function initialOf(name: string) {
  const ch = (name ?? "").trim().charAt(0);
  const up = ch.toUpperCase();
  return up >= "A" && up <= "Z" ? up : "#";
}

export function alphaSort(a: Entry, b: Entry) {
  return a.username.localeCompare(b.username, "en", { sensitivity: "base" });
}

export function buildAlphaIndex(data: Entry[]) {
  const sorted = [...data].sort(alphaSort);

  const buckets = new Map<string, Entry[]>();
  for (const key of GROUPS_ORDER) buckets.set(key, []);
  for (const e of sorted) buckets.get(initialOf(e.username))!.push(e);

  const flat: Entry[] = [];
  const groupCounts: number[] = [];
  const groupLabels: string[] = [];
  const letterToIndex = new Map<string, number>();
  const lettersPresent = new Set<string>();

  let running = 0;
  for (const letter of GROUPS_ORDER) {
    const arr = buckets.get(letter)!;
    if (arr.length === 0) continue;
    groupLabels.push(letter);
    groupCounts.push(arr.length);
    letterToIndex.set(letter, running);
    lettersPresent.add(letter);
    flat.push(...arr);
    running += arr.length;
  }

  return { flat, groupCounts, groupLabels, letterToIndex, lettersPresent };
}
