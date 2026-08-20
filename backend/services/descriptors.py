"""May/SAIC descriptor universe and fuzzy-set figure of merit.

May and Thomson encode a target and a response as answers to the same
set of questions. Each answer is a membership in [0, 1]. Accuracy is
the fraction of the target that the response hits. Reliability is the
fraction of the response that is correct. Figure of merit is the
product [MAY-FOM].

The vocabulary here is a compact operationalization of that method, not
a reprint of any one classified SAIC list. Those lists were pool-specific
and varied across reports. This set covers the site, built, life, form,
and quality questions a picture-pool or coordinate-site lab actually
encodes.
"""

from __future__ import annotations

from typing import Iterable

DESCRIPTOR_GROUPS = (
    "site",
    "built",
    "life",
    "form",
    "quality",
)

DESCRIPTORS: tuple[dict[str, str], ...] = (
    {"id": "water", "label": "Water", "group": "site"},
    {"id": "land", "label": "Land", "group": "site"},
    {"id": "mountain", "label": "Mountain / elevation", "group": "site"},
    {"id": "vegetation", "label": "Vegetation", "group": "site"},
    {"id": "sky", "label": "Open sky", "group": "site"},
    {"id": "structure", "label": "Structure", "group": "built"},
    {"id": "interior", "label": "Interior", "group": "built"},
    {"id": "urban", "label": "Urban / street", "group": "built"},
    {"id": "industrial", "label": "Industrial", "group": "built"},
    {"id": "military", "label": "Military / hardened", "group": "built"},
    {"id": "vehicle", "label": "Vehicle", "group": "built"},
    {"id": "human", "label": "Human", "group": "life"},
    {"id": "animal", "label": "Animal", "group": "life"},
    {"id": "motion", "label": "Motion", "group": "form"},
    {"id": "energy", "label": "Energy / light", "group": "form"},
    {"id": "circular", "label": "Circular / curved", "group": "form"},
    {"id": "vertical", "label": "Vertical", "group": "form"},
    {"id": "horizontal", "label": "Horizontal", "group": "form"},
    {"id": "natural", "label": "Natural", "group": "quality"},
    {"id": "manmade", "label": "Man-made", "group": "quality"},
    {"id": "warm", "label": "Warm", "group": "quality"},
    {"id": "cold", "label": "Cold", "group": "quality"},
    {"id": "wet", "label": "Wet", "group": "quality"},
    {"id": "dry", "label": "Dry", "group": "quality"},
    {"id": "metallic", "label": "Metallic", "group": "quality"},
    {"id": "organic", "label": "Organic / living", "group": "quality"},
)

DESCRIPTOR_IDS: frozenset[str] = frozenset(row["id"] for row in DESCRIPTORS)

# Keyword assist for a judge encoding the transcript. The official
# encoding is whatever the judge submits. This only proposes a start.
_LEXICON: dict[str, tuple[str, ...]] = {
    "water": ("water", "wet", "lake", "ocean", "sea", "river", "pool", "rain", "wave"),
    "land": (
        "land",
        "ground",
        "dirt",
        "sand",
        "soil",
        "earth",
        "beach",
        "desert",
        "dune",
    ),
    "mountain": ("mountain", "peak", "cliff", "rock", "stone", "hill", "elevation"),
    "vegetation": (
        "tree",
        "trees",
        "forest",
        "grass",
        "plant",
        "leaf",
        "vegetation",
        "palm",
    ),
    "sky": ("sky", "cloud", "clouds", "horizon", "air"),
    "structure": (
        "building",
        "structure",
        "house",
        "wall",
        "roof",
        "tower",
        "monument",
        "lighthouse",
        "theatre",
        "theater",
        "mosque",
        "pyramid",
    ),
    "interior": ("inside", "interior", "room", "indoor"),
    "urban": ("city", "street", "urban", "sidewalk", "town"),
    "industrial": ("industrial", "factory", "rust", "barrel", "warehouse"),
    "military": ("military", "bunker", "fortress", "hardened"),
    "vehicle": ("vehicle", "car", "bus", "truck", "van", "boat", "aircraft"),
    "human": ("person", "people", "human", "man", "woman", "child", "figure", "crowd"),
    "animal": ("animal", "cat", "dog", "cow", "camel", "bird", "horse"),
    "motion": ("motion", "moving", "walking", "flowing"),
    "energy": ("energy", "glow", "neon", "bright", "fire", "light"),
    "circular": ("circular", "round", "curve", "curved", "circle", "dome", "wheel"),
    "vertical": ("vertical", "tall", "towering", "upright", "high"),
    "horizontal": ("horizontal", "flat", "wide", "long"),
    "natural": ("natural", "nature", "landscape"),
    "manmade": ("manmade", "man-made", "built", "constructed", "artificial"),
    "warm": ("warm", "hot", "heat", "sun", "sunny"),
    "cold": ("cold", "cool", "ice", "snow"),
    "wet": ("wet", "damp", "moist"),
    "dry": ("dry", "arid", "dusty"),
    "metallic": ("metal", "metallic", "steel", "iron", "chrome", "rust"),
    "organic": ("organic", "fur", "wood", "living"),
}

# Sorted bundled filenames. Memberships are the operator encoding of the
# sealed photograph, not titles. Keep this off the pre-lock wire.
BUNDLED_ENCODINGS: dict[str, dict[str, float]] = {
    "pexels-ayrat-244411276-33847404.jpg": {
        "animal": 1,
        "industrial": 1,
        "metallic": 1,
        "circular": 1,
        "manmade": 1,
        "natural": 1,
        "warm": 1,
        "dry": 1,
        "organic": 1,
        "land": 0.5,
    },
    "pexels-carolin-wenske-762365559-33528679.jpg": {
        "water": 1,
        "land": 1,
        "structure": 0.5,
        "circular": 1,
        "natural": 1,
        "manmade": 1,
        "warm": 1,
        "horizontal": 1,
        "sky": 1,
        "wet": 0.5,
    },
    "pexels-dalida-jakli-2150468204-31151685.jpg": {
        "water": 1,
        "land": 1,
        "mountain": 1,
        "vegetation": 1,
        "human": 1,
        "natural": 1,
        "cold": 1,
        "wet": 1,
        "vertical": 1,
        "organic": 1,
        "sky": 0.5,
    },
    "pexels-gerard-bucud-2152210795-33165873.jpg": {
        "structure": 1,
        "urban": 1,
        "manmade": 1,
        "vertical": 1,
        "energy": 1,
        "sky": 1,
        "vegetation": 0.5,
        "human": 0.5,
        "circular": 0.5,
    },
    "pexels-heinz-klier-261981-4625868.jpg": {
        "land": 1,
        "mountain": 1,
        "vegetation": 1,
        "animal": 1,
        "structure": 0.5,
        "natural": 1,
        "warm": 1,
        "dry": 1,
        "horizontal": 1,
        "sky": 1,
        "organic": 1,
    },
    "pexels-maksym-mazur-886611795-34112204.jpg": {
        "land": 1,
        "structure": 1,
        "animal": 1,
        "manmade": 1,
        "natural": 1,
        "warm": 1,
        "dry": 1,
        "vertical": 1,
        "sky": 1,
        "circular": 0.5,
        "organic": 1,
    },
    "pexels-michael-james-beach-737731076-29857931.jpg": {
        "structure": 1,
        "urban": 1,
        "manmade": 1,
        "metallic": 1,
        "vertical": 1,
        "sky": 1,
        "vegetation": 0.5,
        "land": 0.5,
    },
    "pexels-poppy-martinez-571476080-17244610.jpg": {
        "structure": 1,
        "urban": 1,
        "human": 1,
        "manmade": 1,
        "vertical": 1,
        "energy": 1,
        "vegetation": 0.5,
    },
    "pexels-sergi-montaner-1924032-3727715.jpg": {
        "vehicle": 1,
        "vegetation": 1,
        "land": 1,
        "manmade": 1,
        "circular": 1,
        "horizontal": 1,
        "metallic": 1,
        "natural": 0.5,
        "sky": 0.5,
    },
    "pexels-seyma-emine-tamer-gul-2154462601-33308469.jpg": {
        "structure": 1,
        "urban": 1,
        "human": 1,
        "manmade": 1,
        "vertical": 1,
        "circular": 1,
        "land": 0.5,
        "motion": 0.5,
    },
    "pexels-tommes-frites-1141358642-33869350.jpg": {
        "water": 1,
        "land": 1,
        "structure": 1,
        "sky": 1,
        "natural": 1,
        "manmade": 1,
        "vertical": 1,
        "horizontal": 1,
        "dry": 1,
        "warm": 0.5,
    },
}


def vocabulary() -> list[dict[str, str]]:
    return [dict(row) for row in DESCRIPTORS]


def normalize(encoding: dict | None) -> dict[str, float]:
    """Keep known ids with membership in [0, 1]. Drop zeros."""
    if not encoding:
        return {}
    clean: dict[str, float] = {}
    for key, raw in encoding.items():
        if key not in DESCRIPTOR_IDS:
            continue
        try:
            value = float(raw)
        except (TypeError, ValueError):
            continue
        if value <= 0:
            continue
        clean[key] = 1.0 if value >= 1 else (0.5 if value >= 0.5 else value)
    return clean


def cardinality(encoding: dict[str, float]) -> float:
    return sum(encoding.values())


def has_mass(encoding: dict | None) -> bool:
    return cardinality(normalize(encoding)) > 0


def intersection(target: dict[str, float], response: dict[str, float]) -> float:
    keys = set(target) | set(response)
    return sum(min(target.get(key, 0.0), response.get(key, 0.0)) for key in keys)


def fuzzy_accuracy(target: dict | None, response: dict | None) -> float:
    """Fraction of the target the response describes [MAY-FOM]."""
    t = normalize(target)
    r = normalize(response)
    mag = cardinality(t)
    if mag <= 0:
        return 0.0
    return intersection(t, r) / mag


def fuzzy_reliability(target: dict | None, response: dict | None) -> float:
    """Fraction of the response that is correct [MAY-FOM]."""
    t = normalize(target)
    r = normalize(response)
    mag = cardinality(r)
    if mag <= 0:
        return 0.0
    return intersection(t, r) / mag


def bundled_encoding_for_filename(name: str) -> dict[str, float]:
    return dict(BUNDLED_ENCODINGS.get(name, {}))


def suggest_from_texts(texts: Iterable[str]) -> dict[str, float]:
    """Propose a response encoding from transcript words.

    A judge can edit this. It is not the official score by itself.
    """
    blob = " ".join(texts).lower()
    if not blob.strip():
        return {}
    proposed: dict[str, float] = {}
    for descriptor_id, words in _LEXICON.items():
        hits = sum(1 for word in words if word in blob)
        if hits >= 2:
            proposed[descriptor_id] = 1.0
        elif hits == 1:
            proposed[descriptor_id] = 0.5
    return proposed
