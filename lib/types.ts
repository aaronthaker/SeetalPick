export type CategoryId = "restaurants" | "takeaway" | "watch" | "activities";

export type AppUser = {
  id: string;
  displayName: string;
  avatarColor: string;
  isAdmin?: boolean;
  adminToken?: string;
};

export type PickItem = {
  id: string;
  categoryId: CategoryId;
  name: string;
  subtitle: string;
  imageUrl: string;
  genres: string[];
  tags: string[];
  source: string;
  sourceId?: string;
  sourceUrl?: string;
  addedBy?: string;
  createdAt?: string;
  active?: boolean;
};

export type SwipeDecision = {
  itemId: string;
  userId: string;
  decision: "yes" | "no";
  swipedOn: string;
};

export type CategorySession = {
  categoryId: CategoryId;
  filterKey: string;
  userId: string;
  sessionDate: string;
  completedAt: string;
};

export type AppState = {
  users: AppUser[];
  items: PickItem[];
  swipes: SwipeDecision[];
  sessions: CategorySession[];
};

export type LookupResult = Omit<PickItem, "id" | "addedBy" | "createdAt"> & {
  id: string;
};

export type AdminItemInput = Pick<
  PickItem,
  "categoryId" | "name" | "subtitle" | "imageUrl" | "genres" | "tags" | "source"
> & {
  sourceId?: string;
  sourceUrl?: string;
};
