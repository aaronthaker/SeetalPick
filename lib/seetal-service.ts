"use client";

import { SEED_ITEMS, stableImage, todayKey } from "./catalog";
import type {
  AppState,
  AppUser,
  CategoryId,
  CategorySession,
  LookupResult,
  PickItem,
  SwipeDecision,
} from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const tmdbToken = process.env.NEXT_PUBLIC_TMDB_READ_TOKEN;
const storageKey = "seetal-pick-demo-v1";
const sessionKey = "seetal-pick-session";

const demoUsers: AppUser[] = [
  { id: "partner-one", displayName: "You", avatarColor: "#ef6a56" },
  { id: "partner-two", displayName: "Partner", avatarColor: "#168a77" },
];

const isRemote = Boolean(supabaseUrl && supabaseKey);

type DbUser = {
  id: string;
  display_name: string;
  avatar_color: string;
};

type DbItem = {
  id: string;
  category_id: CategoryId;
  name: string;
  subtitle: string | null;
  image_url: string | null;
  tags: string[] | null;
  source: string;
  source_id: string | null;
  source_url: string | null;
  added_by: string | null;
  created_at: string;
};

function headers(extra?: HeadersInit): HeadersInit {
  return {
    apikey: supabaseKey ?? "",
    Authorization: `Bearer ${supabaseKey ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function supabaseFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: headers(init?.headers),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "The shared database did not respond.");
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function readLocal(): AppState {
  const fallback: AppState = {
    users: demoUsers,
    items: SEED_ITEMS,
    swipes: [],
    sessions: [],
  };

  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      localStorage.setItem(storageKey, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(stored) as AppState;
    return {
      users: parsed.users?.length ? parsed.users : demoUsers,
      items: parsed.items?.length ? parsed.items : SEED_ITEMS,
      swipes: parsed.swipes ?? [],
      sessions: parsed.sessions ?? [],
    };
  } catch {
    return fallback;
  }
}

function writeLocal(state: AppState) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function toUser(user: DbUser): AppUser {
  return {
    id: user.id,
    displayName: user.display_name,
    avatarColor: user.avatar_color,
  };
}

function toItem(item: DbItem): PickItem {
  return {
    id: item.id,
    categoryId: item.category_id,
    name: item.name,
    subtitle: item.subtitle ?? "Added to your shared list",
    imageUrl: item.image_url ?? stableImage(item.category_id, item.name),
    tags: item.tags ?? [],
    source: item.source,
    sourceId: item.source_id ?? undefined,
    sourceUrl: item.source_url ?? undefined,
    addedBy: item.added_by ?? undefined,
    createdAt: item.created_at,
  };
}

export const seetalService = {
  mode: isRemote ? ("supabase" as const) : ("preview" as const),

  getStoredUser(): AppUser | null {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      return stored ? (JSON.parse(stored) as AppUser) : null;
    } catch {
      return null;
    }
  },

  storeUser(user: AppUser | null) {
    if (user) sessionStorage.setItem(sessionKey, JSON.stringify(user));
    else sessionStorage.removeItem(sessionKey);
  },

  async login(passphrase: string): Promise<AppUser> {
    const value = passphrase.trim();
    if (!value) throw new Error("Enter your passphrase to continue.");

    if (!isRemote) {
      const normalized = value.toLowerCase();
      const firstPass = (process.env.NEXT_PUBLIC_DEMO_PASS_ONE ?? "together").toLowerCase();
      const secondPass = (process.env.NEXT_PUBLIC_DEMO_PASS_TWO ?? "always").toLowerCase();
      const user = normalized === firstPass
        ? demoUsers[0]
        : normalized === secondPass
          ? demoUsers[1]
          : null;
      if (!user) throw new Error("That passphrase doesn’t look right. Try again.");
      this.storeUser(user);
      return user;
    }

    const result = await supabaseFetch<DbUser[] | DbUser>("rpc/login_with_passphrase", {
      method: "POST",
      body: JSON.stringify({ provided_passphrase: value }),
    });
    const record = Array.isArray(result) ? result[0] : result;
    if (!record?.id) throw new Error("That passphrase doesn’t look right. Try again.");
    const user = toUser(record);
    this.storeUser(user);
    return user;
  },

  logout() {
    this.storeUser(null);
  },

  async loadState(): Promise<AppState> {
    if (!isRemote) return readLocal();
    const day = todayKey();
    const [users, items, swipes, sessions] = await Promise.all([
      supabaseFetch<DbUser[]>("app_user_profiles?select=id,display_name,avatar_color&active=eq.true&order=created_at.asc"),
      supabaseFetch<DbItem[]>("pick_items?select=*&active=eq.true&order=created_at.desc"),
      supabaseFetch<Array<{ item_id: string; user_id: string; decision: "yes" | "no"; swiped_on: string }>>(
        `swipes?select=item_id,user_id,decision,swiped_on&swiped_on=eq.${day}`,
      ),
      supabaseFetch<Array<{ category_id: CategoryId; user_id: string; session_date: string; completed_at: string }>>(
        `category_sessions?select=category_id,user_id,session_date,completed_at&session_date=eq.${day}`,
      ),
    ]);

    return {
      users: users.map(toUser),
      items: items.map(toItem),
      swipes: swipes.map((swipe) => ({
        itemId: swipe.item_id,
        userId: swipe.user_id,
        decision: swipe.decision,
        swipedOn: swipe.swiped_on,
      })),
      sessions: sessions.map((session) => ({
        categoryId: session.category_id,
        userId: session.user_id,
        sessionDate: session.session_date,
        completedAt: session.completed_at,
      })),
    };
  },

  async saveSwipe(swipe: SwipeDecision): Promise<void> {
    if (!isRemote) {
      const state = readLocal();
      state.swipes = state.swipes.filter(
        (current) =>
          !(current.itemId === swipe.itemId &&
            current.userId === swipe.userId &&
            current.swipedOn === swipe.swipedOn),
      );
      state.swipes.push(swipe);
      writeLocal(state);
      return;
    }

    await supabaseFetch("swipes?on_conflict=user_id,item_id,swiped_on", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: swipe.userId,
        item_id: swipe.itemId,
        decision: swipe.decision,
        swiped_on: swipe.swipedOn,
      }),
    });
  },

  async removeSwipe(userId: string, itemId: string, swipedOn: string): Promise<void> {
    if (!isRemote) {
      const state = readLocal();
      state.swipes = state.swipes.filter(
        (swipe) =>
          !(swipe.userId === userId && swipe.itemId === itemId && swipe.swipedOn === swipedOn),
      );
      writeLocal(state);
      return;
    }

    await supabaseFetch(
      `swipes?user_id=eq.${encodeURIComponent(userId)}&item_id=eq.${encodeURIComponent(itemId)}&swiped_on=eq.${swipedOn}`,
      { method: "DELETE" },
    );
  },

  async completeCategory(session: CategorySession): Promise<void> {
    if (!isRemote) {
      const state = readLocal();
      state.sessions = state.sessions.filter(
        (current) =>
          !(current.userId === session.userId &&
            current.categoryId === session.categoryId &&
            current.sessionDate === session.sessionDate),
      );
      state.sessions.push(session);
      writeLocal(state);
      return;
    }

    await supabaseFetch("category_sessions?on_conflict=user_id,category_id,session_date", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: session.userId,
        category_id: session.categoryId,
        session_date: session.sessionDate,
        completed_at: session.completedAt,
      }),
    });
  },

  async addItem(item: PickItem): Promise<PickItem> {
    if (!isRemote) {
      const state = readLocal();
      state.items.unshift(item);
      writeLocal(state);
      return item;
    }

    const payload = {
      category_id: item.categoryId,
      name: item.name,
      subtitle: item.subtitle,
      image_url: item.imageUrl,
      tags: item.tags,
      source: item.source,
      source_id: item.sourceId ?? null,
      source_url: item.sourceUrl ?? null,
      added_by: item.addedBy ?? null,
    };
    const created = await supabaseFetch<DbItem[]>("pick_items", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return toItem(created[0]);
  },
};

function stripHtml(value: string | null | undefined) {
  return (value ?? "").replace(/<[^>]+>/g, "").trim();
}

function placeImage(result: {
  extratags?: { image?: string; wikimedia_commons?: string };
}, categoryId: CategoryId, seed: string) {
  if (result.extratags?.image?.startsWith("http")) return result.extratags.image;
  const commons = result.extratags?.wikimedia_commons;
  if (commons?.startsWith("File:")) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons.slice(5))}?width=1200`;
  }
  return stableImage(categoryId, seed);
}

export async function searchLookup(
  query: string,
  categoryId: CategoryId,
  location: string,
  signal?: AbortSignal,
): Promise<LookupResult[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  if (categoryId === "watch") {
    if (tmdbToken) {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(cleanQuery)}&include_adult=false&language=en-GB&page=1`,
        { signal, headers: { Authorization: `Bearer ${tmdbToken}` } },
      );
      if (!response.ok) throw new Error("Film lookup is taking a break. Try again shortly.");
      const data = (await response.json()) as {
        results: Array<{
          id: number;
          media_type: string;
          title?: string;
          name?: string;
          release_date?: string;
          first_air_date?: string;
          overview?: string;
          poster_path?: string;
          backdrop_path?: string;
        }>;
      };
      return data.results
        .filter((item) => item.media_type === "movie" || item.media_type === "tv")
        .slice(0, 8)
        .map((item) => {
          const name = item.title ?? item.name ?? cleanQuery;
          const year = (item.release_date ?? item.first_air_date ?? "").slice(0, 4);
          const path = item.backdrop_path ?? item.poster_path;
          return {
            id: `tmdb-${item.media_type}-${item.id}`,
            categoryId,
            name,
            subtitle: `${item.media_type === "movie" ? "Film" : "TV series"}${year ? ` · ${year}` : ""}${item.overview ? ` · ${item.overview.slice(0, 90)}` : ""}`,
            imageUrl: path ? `https://image.tmdb.org/t/p/w1280${path}` : stableImage(categoryId, name),
            tags: [item.media_type === "movie" ? "Film" : "Series", year || "Watchlist"],
            source: "tmdb",
            sourceId: String(item.id),
            sourceUrl: `https://www.themoviedb.org/${item.media_type}/${item.id}`,
          };
        });
    }

    const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(cleanQuery)}`, { signal });
    if (!response.ok) throw new Error("Watch lookup is taking a break. Try again shortly.");
    const data = (await response.json()) as Array<{
      show: {
        id: number;
        name: string;
        premiered?: string;
        genres?: string[];
        summary?: string;
        image?: { original?: string; medium?: string };
        officialSite?: string;
      };
    }>;
    return data.slice(0, 8).map(({ show }) => ({
      id: `tvmaze-${show.id}`,
      categoryId,
      name: show.name,
      subtitle: `TV series${show.premiered ? ` · ${show.premiered.slice(0, 4)}` : ""}${show.genres?.length ? ` · ${show.genres.slice(0, 2).join(" / ")}` : ""}${show.summary ? ` · ${stripHtml(show.summary).slice(0, 80)}` : ""}`,
      imageUrl: show.image?.original ?? show.image?.medium ?? stableImage(categoryId, show.name),
      tags: ["Series", ...(show.genres ?? []).slice(0, 2)],
      source: "tvmaze",
      sourceId: String(show.id),
      sourceUrl: show.officialSite,
    }));
  }

  const typeHint = categoryId === "activities"
    ? "attraction OR leisure"
    : categoryId === "takeaway"
      ? "takeaway"
      : "restaurant";
  const fullQuery = `${cleanQuery} ${typeHint}${location.trim() ? ` in ${location.trim()}` : ""}`;
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=8&q=${encodeURIComponent(fullQuery)}`,
    { signal, headers: { "Accept-Language": "en-GB,en;q=0.8" } },
  );
  if (!response.ok) throw new Error("Place lookup is taking a break. Try again shortly.");
  const data = (await response.json()) as Array<{
    place_id: number;
    display_name: string;
    name?: string;
    type?: string;
    category?: string;
    osm_type?: string;
    osm_id?: number;
    extratags?: { cuisine?: string; image?: string; wikimedia_commons?: string; website?: string };
    address?: { city?: string; town?: string; village?: string; suburb?: string; road?: string };
  }>;

  return data.map((result) => {
    const name = result.name ?? result.display_name.split(",")[0];
    const area = result.address?.suburb ?? result.address?.town ?? result.address?.city ?? result.address?.village;
    const kind = result.extratags?.cuisine ?? result.type ?? result.category ?? CATEGORY_LABELS[categoryId];
    return {
      id: `osm-${result.place_id}`,
      categoryId,
      name,
      subtitle: [kind.replaceAll("_", " "), area, result.display_name.split(",").slice(-2, -1)[0]?.trim()]
        .filter(Boolean)
        .join(" · "),
      imageUrl: placeImage(result, categoryId, name),
      tags: [kind.replaceAll("_", " "), area ?? "Local"].filter(Boolean),
      source: "openstreetmap",
      sourceId: `${result.osm_type ?? "place"}-${result.osm_id ?? result.place_id}`,
      sourceUrl: result.extratags?.website ?? `https://www.openstreetmap.org/${result.osm_type ?? "node"}/${result.osm_id ?? result.place_id}`,
    };
  });
}

const CATEGORY_LABELS: Record<CategoryId, string> = {
  restaurants: "Restaurant",
  takeaway: "Takeaway",
  watch: "Watch",
  activities: "Activity",
};
