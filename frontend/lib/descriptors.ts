/** May/SAIC descriptor vocabulary, mirrored from the backend. */

export type Membership = 0 | 0.5 | 1;

export interface Descriptor {
  id: string;
  label: string;
  group: string;
}

export const DESCRIPTOR_GROUPS = [
  "site",
  "built",
  "life",
  "form",
  "quality",
] as const;

export const DESCRIPTORS: readonly Descriptor[] = [
  { id: "water", label: "Water", group: "site" },
  { id: "land", label: "Land", group: "site" },
  { id: "mountain", label: "Mountain / elevation", group: "site" },
  { id: "vegetation", label: "Vegetation", group: "site" },
  { id: "sky", label: "Open sky", group: "site" },
  { id: "structure", label: "Structure", group: "built" },
  { id: "interior", label: "Interior", group: "built" },
  { id: "urban", label: "Urban / street", group: "built" },
  { id: "industrial", label: "Industrial", group: "built" },
  { id: "military", label: "Military / hardened", group: "built" },
  { id: "vehicle", label: "Vehicle", group: "built" },
  { id: "human", label: "Human", group: "life" },
  { id: "animal", label: "Animal", group: "life" },
  { id: "motion", label: "Motion", group: "form" },
  { id: "energy", label: "Energy / light", group: "form" },
  { id: "circular", label: "Circular / curved", group: "form" },
  { id: "vertical", label: "Vertical", group: "form" },
  { id: "horizontal", label: "Horizontal", group: "form" },
  { id: "natural", label: "Natural", group: "quality" },
  { id: "manmade", label: "Man-made", group: "quality" },
  { id: "warm", label: "Warm", group: "quality" },
  { id: "cold", label: "Cold", group: "quality" },
  { id: "wet", label: "Wet", group: "quality" },
  { id: "dry", label: "Dry", group: "quality" },
  { id: "metallic", label: "Metallic", group: "quality" },
  { id: "organic", label: "Organic / living", group: "quality" },
];

const KNOWN = new Set(DESCRIPTORS.map((row) => row.id));

export function normalizeEncoding(
  encoding: Record<string, number> | null | undefined,
): Record<string, number> {
  if (!encoding) return {};
  const clean: Record<string, number> = {};
  for (const [key, raw] of Object.entries(encoding)) {
    if (!KNOWN.has(key)) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;
    clean[key] = value >= 1 ? 1 : value >= 0.5 ? 0.5 : value;
  }
  return clean;
}

export function cycleMembership(current: Membership): Membership {
  if (current === 0) return 1;
  if (current === 1) return 0.5;
  return 0;
}

export function membershipOf(
  encoding: Record<string, number>,
  id: string,
): Membership {
  const value = encoding[id] ?? 0;
  if (value >= 1) return 1;
  if (value >= 0.5) return 0.5;
  return 0;
}
