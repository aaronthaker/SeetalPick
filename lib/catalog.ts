import type { CategoryId, PickItem } from "./types";

export const CATEGORY_META: Record<
  CategoryId,
  {
    label: string;
    singular: string;
    eyebrow: string;
    description: string;
    accent: string;
    soft: string;
  }
> = {
  restaurants: {
    label: "Restaurants",
    singular: "restaurant",
    eyebrow: "Dress up a little",
    description: "Find somewhere worth leaving the house for.",
    accent: "#ef6a56",
    soft: "#fff0ec",
  },
  takeaway: {
    label: "Takeaway",
    singular: "takeaway",
    eyebrow: "Stay in, eat well",
    description: "Pick the comfort food that wins tonight.",
    accent: "#6e5ae8",
    soft: "#f0edff",
  },
  watch: {
    label: "Watch",
    singular: "film or show",
    eyebrow: "One screen, no scrolling",
    description: "End the endless search for something to watch.",
    accent: "#e9a32c",
    soft: "#fff6dd",
  },
  activities: {
    label: "Activities",
    singular: "activity",
    eyebrow: "Make a memory",
    description: "Turn spare time into a proper little adventure.",
    accent: "#168a77",
    soft: "#e5f7f2",
  },
};

export const CATEGORY_ORDER: CategoryId[] = [
  "restaurants",
  "takeaway",
  "watch",
  "activities",
];

export const GENRE_OPTIONS: Record<CategoryId, string[]> = {
  restaurants: ["Italian", "Japanese", "Indian", "Chinese", "Thai", "Mediterranean", "Mexican", "British", "Other"],
  takeaway: ["Pizza", "Indian", "Chinese", "Thai", "Japanese", "Burgers", "Chicken", "Mexican", "Healthy", "Desserts", "Other"],
  watch: ["Comedy", "Drama", "Romance", "Action", "Thriller", "Horror", "Mystery", "Sci-Fi", "Fantasy", "Documentary", "Animation", "Family", "Other"],
  activities: ["Creative", "Outdoors", "Active", "Games", "Culture", "Relaxed", "Food & drink", "Day trip", "At home", "Other"],
};

export function normalizeFilterKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all";
}

export function genreLabel(categoryId: CategoryId, filterKey: string) {
  if (filterKey === "all") return "All";
  return GENRE_OPTIONS[categoryId].find((genre) => normalizeFilterKey(genre) === filterKey) ?? filterKey;
}

export function inferGenres(categoryId: CategoryId, tags: string[]) {
  const options = GENRE_OPTIONS[categoryId];
  const lowerTags = tags.map((tag) => tag.toLowerCase());
  const exact = options.filter((genre) => lowerTags.some((tag) => tag.includes(genre.toLowerCase())));
  if (exact.length) return exact;
  return ["Other"];
}

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=86`;

export const CATEGORY_FALLBACK_IMAGES: Record<CategoryId, string[]> = {
  restaurants: [
    image("photo-1517248135467-4c7edcad34c4"),
    image("photo-1559339352-11d035aa65de"),
    image("photo-1414235077428-338989a2e8c0"),
  ],
  takeaway: [
    image("photo-1579751626657-72bc17010498"),
    image("photo-1551504734-5ee1c4a1479b"),
    image("photo-1585937421612-70a008356fbe"),
  ],
  watch: [
    image("photo-1489599849927-2ee91cede3ba"),
    image("photo-1440404653325-ab127d49abc1"),
    image("photo-1586899028174-e7098604235b"),
  ],
  activities: [
    image("photo-1610701596007-11502861dcfa"),
    image("photo-1528605248644-14dd04022da1"),
    image("photo-1538511059256-0b056e6d5c59"),
  ],
};

export const SEED_ITEMS: PickItem[] = [
  {
    id: "rest-pasta",
    categoryId: "restaurants",
    name: "Little Napoli",
    subtitle: "Cosy Italian · Handmade pasta · ££",
    imageUrl: image("photo-1579684947550-22e945225d9a"),
    genres: ["Italian"],
    tags: ["Italian", "Date night", "Cosy"],
    source: "starter",
  },
  {
    id: "rest-sushi",
    categoryId: "restaurants",
    name: "Koya House",
    subtitle: "Japanese · Sushi counter · £££",
    imageUrl: image("photo-1579871494447-9811cf80d66c"),
    genres: ["Japanese"],
    tags: ["Japanese", "Sushi", "Special"],
    source: "starter",
  },
  {
    id: "rest-bistro",
    categoryId: "restaurants",
    name: "The Green Room",
    subtitle: "Modern British · Seasonal menu · ££",
    imageUrl: image("photo-1515003197210-e0cd71810b5f"),
    genres: ["British"],
    tags: ["British", "Local", "Relaxed"],
    source: "starter",
  },
  {
    id: "rest-tapas",
    categoryId: "restaurants",
    name: "Sol y Sal",
    subtitle: "Spanish · Small plates · ££",
    imageUrl: image("photo-1516211697506-8360dbcfe9a4"),
    genres: ["Mediterranean"],
    tags: ["Tapas", "Sharing", "Lively"],
    source: "starter",
  },
  {
    id: "take-pizza",
    categoryId: "takeaway",
    name: "Neapolitan pizza",
    subtitle: "Charred crusts, proper mozzarella, zero washing up",
    imageUrl: image("photo-1579751626657-72bc17010498"),
    genres: ["Pizza"],
    tags: ["Pizza", "Comfort", "Shareable"],
    source: "starter",
  },
  {
    id: "take-thai",
    categoryId: "takeaway",
    name: "Thai night",
    subtitle: "Curries, noodles and something with a little kick",
    imageUrl: image("photo-1455619452474-d2be8b1e70cd"),
    genres: ["Thai"],
    tags: ["Thai", "Spicy", "Cosy"],
    source: "starter",
  },
  {
    id: "take-indian",
    categoryId: "takeaway",
    name: "Indian feast",
    subtitle: "A table full of curries, rice and too much naan",
    imageUrl: image("photo-1585937421612-70a008356fbe"),
    genres: ["Indian"],
    tags: ["Indian", "Feast", "Vegetarian friendly"],
    source: "starter",
  },
  {
    id: "take-tacos",
    categoryId: "takeaway",
    name: "Tacos & sides",
    subtitle: "A messy, colourful, very good idea",
    imageUrl: image("photo-1551504734-5ee1c4a1479b"),
    genres: ["Mexican"],
    tags: ["Mexican", "Fun", "Shareable"],
    source: "starter",
  },
  {
    id: "watch-bear",
    categoryId: "watch",
    name: "The Bear",
    subtitle: "Comedy drama · 2022 · 30 min episodes",
    imageUrl: image("photo-1489599849927-2ee91cede3ba"),
    genres: ["Comedy", "Drama"],
    tags: ["Series", "Drama", "Bingeable"],
    source: "starter",
  },
  {
    id: "watch-knives",
    categoryId: "watch",
    name: "Knives Out",
    subtitle: "Mystery comedy · 2019 · 2h 10m",
    imageUrl: image("photo-1440404653325-ab127d49abc1"),
    genres: ["Mystery", "Comedy"],
    tags: ["Film", "Mystery", "Funny"],
    source: "starter",
  },
  {
    id: "watch-past",
    categoryId: "watch",
    name: "Past Lives",
    subtitle: "Romance drama · 2023 · 1h 46m",
    imageUrl: image("photo-1485095329183-d0797cdc5676"),
    genres: ["Romance", "Drama"],
    tags: ["Film", "Romance", "Thoughtful"],
    source: "starter",
  },
  {
    id: "watch-only",
    categoryId: "watch",
    name: "Only Murders in the Building",
    subtitle: "Mystery comedy · 2021 · 35 min episodes",
    imageUrl: image("photo-1586899028174-e7098604235b"),
    genres: ["Mystery", "Comedy"],
    tags: ["Series", "Mystery", "Light"],
    source: "starter",
  },
  {
    id: "act-pottery",
    categoryId: "activities",
    name: "Pottery painting",
    subtitle: "Pick a piece, choose your colours and make a keepsake",
    imageUrl: image("photo-1610701596007-11502861dcfa"),
    genres: ["Creative", "Relaxed"],
    tags: ["Creative", "Indoors", "2–3 hours"],
    source: "starter",
  },
  {
    id: "act-picnic",
    categoryId: "activities",
    name: "Golden-hour picnic",
    subtitle: "A blanket, favourite snacks and nowhere else to be",
    imageUrl: image("photo-1528605248644-14dd04022da1"),
    genres: ["Outdoors", "Relaxed", "Food & drink"],
    tags: ["Outdoors", "Low-key", "Romantic"],
    source: "starter",
  },
  {
    id: "act-bowling",
    categoryId: "activities",
    name: "Bowling rematch",
    subtitle: "One game, a little competition and questionable shoes",
    imageUrl: image("photo-1538511059256-0b056e6d5c59"),
    genres: ["Active", "Games"],
    tags: ["Playful", "Indoors", "1–2 hours"],
    source: "starter",
  },
  {
    id: "act-walk",
    categoryId: "activities",
    name: "A new neighbourhood walk",
    subtitle: "Coffee in hand, phones away, choose turns as you go",
    imageUrl: image("photo-1519501025264-65ba15a82390"),
    genres: ["Outdoors", "Day trip"],
    tags: ["Free", "Outdoors", "Spontaneous"],
    source: "starter",
  },
];

export function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function stableImage(categoryId: CategoryId, seed: string) {
  const images = CATEGORY_FALLBACK_IMAGES[categoryId];
  const hash = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);
  return images[hash % images.length];
}
