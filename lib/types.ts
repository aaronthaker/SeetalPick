export type CategoryId = "restaurants" | "takeaway" | "watch" | "activities";

export type AppUser = {
  id: string;
  displayName: string;
  avatarColor: string;
};

export type PickItem = {
  id: string;
  categoryId: CategoryId;
  name: string;
  subtitle: string;
  imageUrl: string;
  tags: string[];
  source: string;
  sourceId?: string;
  sourceUrl?: string;
  addedBy?: string;
  createdAt?: string;
};

export type SwipeDecision = {
  itemId: string;
  userId: string;
  decision: "yes" | "no";
  swipedOn: string;
};

export type CategorySession = {
  categoryId: CategoryId;
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

