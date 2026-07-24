"use client";
/* eslint-disable @next/next/no-img-element */

import {
  ArrowRight,
  CalendarDays,
  Check,
  ChefHat,
  ChevronLeft,
  CircleCheck,
  Clapperboard,
  Clock3,
  ExternalLink,
  EyeOff,
  Gamepad2,
  Heart,
  Home,
  Info,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trophy,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CATEGORY_FALLBACK_IMAGES,
  CATEGORY_META,
  CATEGORY_ORDER,
  stableImage,
  todayKey,
} from "@/lib/catalog";
import { searchLookup, seetalService } from "@/lib/seetal-service";
import type {
  AppState,
  AppUser,
  CategoryId,
  LookupResult,
  PickItem,
  SwipeDecision,
} from "@/lib/types";

type View = "home" | "swipe" | "matches" | "add";

const iconByCategory = {
  restaurants: Utensils,
  takeaway: ChefHat,
  watch: Clapperboard,
  activities: Gamepad2,
};

const emptyState: AppState = { users: [], items: [], swipes: [], sessions: [] };

function formatDay() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function firstName(name: string) {
  return name.split(" ")[0] || name;
}

function categoryItems(state: AppState, categoryId: CategoryId) {
  return state.items.filter((item) => item.categoryId === categoryId);
}

function hasCompleted(state: AppState, userId: string, categoryId: CategoryId) {
  const day = todayKey();
  return state.sessions.some(
    (session) =>
      session.userId === userId &&
      session.categoryId === categoryId &&
      session.sessionDate === day,
  );
}

function matchesFor(state: AppState, categoryId: CategoryId, users: AppUser[]) {
  if (users.length < 2) return [];
  const day = todayKey();
  const yes = new Set(
    state.swipes
      .filter((swipe) => swipe.swipedOn === day && swipe.decision === "yes")
      .map((swipe) => `${swipe.userId}:${swipe.itemId}`),
  );
  return categoryItems(state, categoryId).filter((item) =>
    users.every((user) => yes.has(`${user.id}:${item.id}`)),
  );
}

export default function SeetalPickApp() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [state, setState] = useState<AppState>(emptyState);
  const [view, setView] = useState<View>("home");
  const [activeCategory, setActiveCategory] = useState<CategoryId>("restaurants");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3000);
  }, []);

  const refresh = useCallback(async () => {
    const next = await seetalService.loadState();
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      await Promise.resolve();
      const stored = seetalService.getStoredUser();
      if (!stored) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!cancelled) setUser(stored);
      try {
        await refresh();
      } catch {
        showNotice("We couldn’t refresh the shared picks just yet.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void hydrate();
    return () => { cancelled = true; };
  }, [refresh, showNotice]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  async function handleLogin(passphrase: string) {
    const loggedIn = await seetalService.login(passphrase);
    setUser(loggedIn);
    setLoading(true);
    try {
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  function openCategory(categoryId: CategoryId) {
    setActiveCategory(categoryId);
    setView("swipe");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSwipe(itemId: string, decision: "yes" | "no") {
    if (!user) return;
    const swipe: SwipeDecision = {
      itemId,
      userId: user.id,
      decision,
      swipedOn: todayKey(),
    };
    setState((current) => ({
      ...current,
      swipes: [
        ...current.swipes.filter(
          (existing) =>
            !(existing.itemId === itemId &&
              existing.userId === user.id &&
              existing.swipedOn === swipe.swipedOn),
        ),
        swipe,
      ],
    }));
    await seetalService.saveSwipe(swipe);
  }

  async function handleUndo(itemId: string) {
    if (!user) return;
    const day = todayKey();
    setState((current) => ({
      ...current,
      swipes: current.swipes.filter(
        (swipe) =>
          !(swipe.itemId === itemId && swipe.userId === user.id && swipe.swipedOn === day),
      ),
    }));
    await seetalService.removeSwipe(user.id, itemId, day);
  }

  async function handleComplete(categoryId: CategoryId) {
    if (!user || hasCompleted(state, user.id, categoryId)) return state;
    const session = {
      categoryId,
      userId: user.id,
      sessionDate: todayKey(),
      completedAt: new Date().toISOString(),
    };
    setState((current) => ({ ...current, sessions: [...current.sessions, session] }));
    await seetalService.completeCategory(session);
    return refresh();
  }

  async function handleAdd(item: PickItem) {
    const saved = await seetalService.addItem(item);
    setState((current) => ({ ...current, items: [saved, ...current.items] }));
    showNotice(`${saved.name} is now in your shared deck.`);
    return saved;
  }

  function logout() {
    seetalService.logout();
    setUser(null);
    setState(emptyState);
    setView("home");
  }

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const partner = state.users.find((candidate) => candidate.id !== user.id) ?? null;

  return (
    <div className="app-shell">
      <div className="ambient-shape ambient-one" />
      <div className="ambient-shape ambient-two" />
      <AppHeader
        user={user}
        partner={partner}
        onHome={() => setView("home")}
        onAdd={() => setView("add")}
        onLogout={logout}
      />

      <main className={view === "swipe" ? "app-main app-main-swipe" : "app-main"}>
        {view === "home" && (
          <HomeView
            state={state}
            user={user}
            partner={partner}
            onCategory={openCategory}
            onMatches={() => setView("matches")}
            onAdd={() => setView("add")}
          />
        )}
        {view === "swipe" && (
          <SwipeExperience
            state={state}
            user={user}
            partner={partner}
            categoryId={activeCategory}
            onBack={() => setView("home")}
            onSwipe={handleSwipe}
            onUndo={handleUndo}
            onComplete={handleComplete}
            onMatches={() => setView("matches")}
          />
        )}
        {view === "matches" && (
          <MatchesView
            state={state}
            user={user}
            partner={partner}
            onBack={() => setView("home")}
            onCategory={openCategory}
          />
        )}
        {view === "add" && (
          <AddView
            user={user}
            existingItems={state.items}
            onBack={() => setView("home")}
            onAdd={handleAdd}
          />
        )}
      </main>

      {view !== "swipe" && (
        <BottomNav view={view} onView={setView} />
      )}
      <div className={`toast ${notice ? "toast-visible" : ""}`} role="status" aria-live="polite">
        <CircleCheck size={18} />
        <span>{notice}</span>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen" aria-label="Loading your shared picks">
      <BrandMark />
      <div className="loading-pulse"><Heart size={22} fill="currentColor" /></div>
      <p>Getting your picks together…</p>
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`} aria-label="Seetal Pick">
      <span className="brand-symbol"><Heart size={compact ? 15 : 19} fill="currentColor" /></span>
      <span className="brand-word">Seetal<span>Pick</span></span>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (passphrase: string) => Promise<void> }) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onLogin(passphrase);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That didn’t work. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-orb orb-left" />
      <div className="login-orb orb-right" />
      <div className="login-preview-card preview-restaurant">
        <span>TONIGHT?</span>
        <strong>Fresh pasta</strong>
        <div><X size={15} /><Heart size={15} fill="currentColor" /></div>
      </div>
      <div className="login-preview-card preview-activity">
        <span>THIS WEEKEND?</span>
        <strong>Pottery class</strong>
        <div><X size={15} /><Heart size={15} fill="currentColor" /></div>
      </div>

      <section className="login-panel">
        <BrandMark />
        <div className="login-copy">
          <span className="eyebrow"><Sparkles size={14} /> Two people. One great plan.</span>
          <h1>Less “I don’t mind.”<br />More <em>“perfect.”</em></h1>
          <p>Swipe separately, match instantly, and spend more time enjoying the answer.</p>
        </div>
        <form className="passphrase-form" onSubmit={submit}>
          <label htmlFor="passphrase">Your secret passphrase</label>
          <div className={`passphrase-input ${error ? "input-error" : ""}`}>
            <LockKeyhole size={19} />
            <input
              id="passphrase"
              type="password"
              autoComplete="current-password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Something only you know"
              autoFocus
            />
            <button type="submit" aria-label="Enter Seetal Pick" disabled={submitting || !passphrase.trim()}>
              {submitting ? <LoaderCircle className="spin" size={19} /> : <ArrowRight size={19} />}
            </button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>

        {seetalService.mode === "preview" && (
          <div className="preview-access">
            <button type="button" onClick={() => setShowHint((current) => !current)}>
              <Info size={14} /> Preview access
            </button>
            {showHint && <p>Use <strong>together</strong> or <strong>always</strong> to try both sides.</p>}
          </div>
        )}
        <p className="login-footnote"><EyeOff size={14} /> No profiles, feeds or awkward group chats. Just the two of you.</p>
      </section>
    </main>
  );
}

function AppHeader({
  user,
  partner,
  onHome,
  onAdd,
  onLogout,
}: {
  user: AppUser;
  partner: AppUser | null;
  onHome: () => void;
  onAdd: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="app-header">
      <button className="logo-button" type="button" onClick={onHome} aria-label="Go home">
        <BrandMark compact />
      </button>
      <div className="header-actions">
        <button className="header-add" type="button" onClick={onAdd}>
          <Plus size={17} /> <span>Add an idea</span>
        </button>
        <div className="profile-wrap">
          <button
            className="profile-button"
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-label="Open profile menu"
          >
            <Avatar user={user} />
            {partner && <span className="partner-dot" style={{ background: partner.avatarColor }} />}
          </button>
          {open && (
            <div className="profile-menu">
              <div className="profile-menu-user">
                <Avatar user={user} />
                <div><strong>{user.displayName}</strong><span>{seetalService.mode === "supabase" ? "Shared live data" : "Preview mode"}</span></div>
              </div>
              <button type="button" onClick={onLogout}><LogOut size={16} /> Switch player</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Avatar({ user, small = false }: { user: AppUser; small?: boolean }) {
  return (
    <span
      className={`avatar ${small ? "avatar-small" : ""}`}
      style={{ backgroundColor: user.avatarColor }}
      title={user.displayName}
      aria-label={user.displayName}
    >
      {firstName(user.displayName).slice(0, 1).toUpperCase()}
    </span>
  );
}

function HomeView({
  state,
  user,
  partner,
  onCategory,
  onMatches,
  onAdd,
}: {
  state: AppState;
  user: AppUser;
  partner: AppUser | null;
  onCategory: (id: CategoryId) => void;
  onMatches: () => void;
  onAdd: () => void;
}) {
  const totalMatches = CATEGORY_ORDER.reduce(
    (total, categoryId) => total + matchesFor(state, categoryId, partner ? [user, partner] : [user]).length,
    0,
  );
  const readyCategories = partner
    ? CATEGORY_ORDER.filter(
        (id) => hasCompleted(state, user.id, id) && hasCompleted(state, partner.id, id),
      ).length
    : 0;

  return (
    <div className="home-view page-enter">
      <section className="home-hero">
        <div className="hero-copy">
          <span className="date-pill"><CalendarDays size={15} /> {formatDay()}</span>
          <h1>What feels good<br /><em>today?</em></h1>
          <p>Pick a deck, trust your gut, and let the overlap do the deciding.</p>
        </div>
        <div className="hero-score-card">
          <div className="score-top">
            <span className="score-icon"><Zap size={20} fill="currentColor" /></span>
            <span>Today’s spark</span>
          </div>
          <strong>{totalMatches}</strong>
          <p>{totalMatches === 1 ? "shared yes so far" : "shared yeses so far"}</p>
          <div className="together-row">
            <Avatar user={user} small />
            {partner ? <Avatar user={partner} small /> : <span className="empty-avatar">?</span>}
            <span>{readyCategories}/4 decks together</span>
          </div>
        </div>
      </section>

      <section className="category-section">
        <div className="section-heading">
          <div><span className="eyebrow">Choose your mood</span><h2>Pick a deck</h2></div>
          <button type="button" onClick={onMatches}>See matches <ArrowRight size={16} /></button>
        </div>
        <div className="category-grid">
          {CATEGORY_ORDER.map((categoryId) => (
            <CategoryCard
              key={categoryId}
              categoryId={categoryId}
              state={state}
              user={user}
              partner={partner}
              onClick={() => onCategory(categoryId)}
            />
          ))}
        </div>
      </section>

      <section className="add-banner">
        <div className="add-banner-visual"><Plus size={28} /></div>
        <div><span className="eyebrow">Keep it yours</span><h3>Got somewhere—or something—in mind?</h3><p>Search it, add it once, and it’ll join your shared decks for good.</p></div>
        <button type="button" onClick={onAdd}>Add an idea <ArrowRight size={17} /></button>
      </section>
    </div>
  );
}

function CategoryCard({
  categoryId,
  state,
  user,
  partner,
  onClick,
}: {
  categoryId: CategoryId;
  state: AppState;
  user: AppUser;
  partner: AppUser | null;
  onClick: () => void;
}) {
  const meta = CATEGORY_META[categoryId];
  const Icon = iconByCategory[categoryId];
  const items = categoryItems(state, categoryId);
  const day = todayKey();
  const answered = state.swipes.filter(
    (swipe) =>
      swipe.userId === user.id &&
      swipe.swipedOn === day &&
      items.some((item) => item.id === swipe.itemId),
  ).length;
  const done = hasCompleted(state, user.id, categoryId);
  const partnerDone = partner ? hasCompleted(state, partner.id, categoryId) : false;
  const together = partner && done && partnerDone;
  const count = together ? matchesFor(state, categoryId, [user, partner]).length : 0;
  const progress = items.length ? Math.min(100, (answered / items.length) * 100) : 0;

  return (
    <button
      type="button"
      className="category-card"
      onClick={onClick}
      style={{ "--accent": meta.accent, "--soft": meta.soft } as CSSProperties}
    >
      <div className="category-card-top">
        <span className="category-icon"><Icon size={22} /></span>
        <span className={`status-chip ${together ? "status-ready" : done ? "status-waiting" : ""}`}>
          {together ? `${count} ${count === 1 ? "match" : "matches"}` : done ? "Waiting" : `${items.length} cards`}
        </span>
      </div>
      <div className="category-card-copy">
        <span>{meta.eyebrow}</span>
        <h3>{meta.label}</h3>
        <p>{meta.description}</p>
      </div>
      <div className="category-progress">
        <div className="mini-avatars">
          <span className={done ? "mini-done" : ""} style={{ background: user.avatarColor }}>{done ? <Check size={11} /> : firstName(user.displayName)[0]}</span>
          {partner && <span className={partnerDone ? "mini-done" : ""} style={{ background: partner.avatarColor }}>{partnerDone ? <Check size={11} /> : firstName(partner.displayName)[0]}</span>}
        </div>
        <div className="progress-track"><span style={{ width: `${done ? 100 : progress}%` }} /></div>
        <ArrowRight size={18} />
      </div>
    </button>
  );
}

function SwipeExperience({
  state,
  user,
  partner,
  categoryId,
  onBack,
  onSwipe,
  onUndo,
  onComplete,
  onMatches,
}: {
  state: AppState;
  user: AppUser;
  partner: AppUser | null;
  categoryId: CategoryId;
  onBack: () => void;
  onSwipe: (itemId: string, decision: "yes" | "no") => Promise<void>;
  onUndo: (itemId: string) => Promise<void>;
  onComplete: (categoryId: CategoryId) => Promise<AppState>;
  onMatches: () => void;
}) {
  const meta = CATEGORY_META[categoryId];
  const allItems = useMemo(() => categoryItems(state, categoryId), [state, categoryId]);
  const todaySwipes = useMemo(
    () => state.swipes.filter(
      (swipe) => swipe.userId === user.id && swipe.swipedOn === todayKey() && allItems.some((item) => item.id === swipe.itemId),
    ),
    [state.swipes, user.id, allItems],
  );
  const swipedIds = useMemo(() => new Set(todaySwipes.map((swipe) => swipe.itemId)), [todaySwipes]);
  const remaining = allItems.filter((item) => !swipedIds.has(item.id));
  const current = remaining[0];
  const next = remaining[1];
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<"yes" | "no" | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const start = useRef<{ x: number; y: number } | null>(null);
  const completing = useRef(false);
  const currentDone = hasCompleted(state, user.id, categoryId);
  const partnerDone = partner ? hasCompleted(state, partner.id, categoryId) : false;
  const matchItems = partner ? matchesFor(state, categoryId, [user, partner]) : [];
  const yesCount = todaySwipes.filter((swipe) => swipe.decision === "yes").length;

  const finishCategory = useCallback(async () => {
    if (completing.current || currentDone) return;
    completing.current = true;
    setFinishing(true);
    try {
      await onComplete(categoryId);
    } catch {
      setError("Your picks are safe, but we couldn’t finish the deck. Tap to try again.");
      completing.current = false;
    } finally {
      setFinishing(false);
    }
  }, [categoryId, currentDone, onComplete]);

  const decide = useCallback(async (decision: "yes" | "no") => {
    if (!current || exitDirection) return;
    setExitDirection(decision);
    setDragX(decision === "yes" ? 620 : -620);
    setDragY(-10);
    window.setTimeout(async () => {
      try {
        await onSwipe(current.id, decision);
        if (remaining.length === 1) await finishCategory();
        setError("");
      } catch {
        setError("That swipe didn’t save. Give it another go.");
      } finally {
        setExitDirection(null);
        setDragX(0);
        setDragY(0);
      }
    }, 260);
  }, [current, exitDirection, finishCategory, onSwipe, remaining.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") decide("no");
      if (event.key === "ArrowRight") decide("yes");
      if (event.key === "Escape") onBack();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [decide, onBack]);

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (exitDirection) return;
    start.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current || exitDirection) return;
    setDragX(event.clientX - start.current.x);
    setDragY((event.clientY - start.current.y) * 0.25);
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    start.current = null;
    setDragging(false);
    if (Math.abs(dragX) > 92) decide(dragX > 0 ? "yes" : "no");
    else {
      setDragX(0);
      setDragY(0);
    }
  }

  async function undo() {
    const last = todaySwipes[todaySwipes.length - 1];
    if (!last || exitDirection) return;
    try {
      await onUndo(last.itemId);
      setError("");
    } catch {
      setError("We couldn’t undo that one just yet.");
    }
  }

  if (!current && (currentDone || finishing)) {
    return (
      <CompletionView
        categoryId={categoryId}
        user={user}
        partner={partner}
        partnerDone={partnerDone}
        matches={matchItems}
        yesCount={yesCount}
        finishing={finishing}
        error={error}
        onRetry={finishCategory}
        onHome={onBack}
        onMatches={onMatches}
      />
    );
  }

  if (!current && allItems.length > 0) {
    return (
      <CompletionView
        categoryId={categoryId}
        user={user}
        partner={partner}
        partnerDone={partnerDone}
        matches={matchItems}
        yesCount={yesCount}
        finishing={false}
        error="All cards are answered. Tap here to finish this deck."
        onRetry={finishCategory}
        onHome={onBack}
        onMatches={onMatches}
      />
    );
  }

  if (!allItems.length) {
    return (
      <div className="empty-deck page-enter">
        <button className="back-link" type="button" onClick={onBack}><ChevronLeft size={18} /> All decks</button>
        <span className="empty-deck-icon"><Plus size={28} /></span>
        <h1>This deck is waiting for its first idea.</h1>
        <p>Add a {meta.singular}, then come back here to start swiping.</p>
      </div>
    );
  }

  const answered = allItems.length - remaining.length;
  const tilt = Math.max(-11, Math.min(11, dragX / 18));
  const cardStyle = {
    transform: `translate3d(${dragX}px, ${dragY}px, 0) rotate(${tilt}deg)`,
    transition: dragging ? "none" : "transform 260ms cubic-bezier(.2,.8,.2,1)",
  } as CSSProperties;

  return (
    <div className="swipe-view page-enter" style={{ "--accent": meta.accent } as CSSProperties}>
      <div className="swipe-topbar">
        <button className="round-back" type="button" onClick={onBack} aria-label="Back to all decks"><ChevronLeft size={21} /></button>
        <div className="swipe-title"><span>{meta.eyebrow}</span><strong>{meta.label}</strong></div>
        <div className="swipe-people">
          <Avatar user={user} small />
          {partner && <Avatar user={partner} small />}
        </div>
      </div>
      <div className="swipe-progress-wrap">
        <span>{answered} of {allItems.length}</span>
        <div className="swipe-progress"><span style={{ width: `${(answered / allItems.length) * 100}%` }} /></div>
        <span>Go with your gut</span>
      </div>

      <div className="deck-stage">
        {next && <SwipeCard item={next} className="swipe-card-behind" />}
        {current && (
          <div
            className={`swipe-card-wrap ${exitDirection ? "is-exiting" : ""}`}
            style={cardStyle}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
          >
            <SwipeCard item={current} />
            <div className="swipe-stamp stamp-no" style={{ opacity: Math.max(0, Math.min(1, -dragX / 90)) }}>NOT THIS</div>
            <div className="swipe-stamp stamp-yes" style={{ opacity: Math.max(0, Math.min(1, dragX / 90)) }}>YES, PLEASE</div>
          </div>
        )}
      </div>

      <div className="swipe-controls">
        <button className="swipe-button swipe-no" type="button" onClick={() => decide("no")} aria-label="No, skip this"><X size={27} /></button>
        <button className="undo-button" type="button" onClick={undo} disabled={!todaySwipes.length} aria-label="Undo last swipe"><RotateCcw size={19} /></button>
        <button className="swipe-button swipe-yes" type="button" onClick={() => decide("yes")} aria-label="Yes, I like this"><Heart size={26} fill="currentColor" /></button>
      </div>
      <p className="swipe-hint"><span><ChevronLeft size={14} /> No</span><span>Swipe or use arrow keys</span><span>Yes <ArrowRight size={14} /></span></p>
      {error && <button className="inline-error" type="button" onClick={() => setError("")}>{error}</button>}
    </div>
  );
}

function SwipeCard({ item, className = "" }: { item: PickItem; className?: string }) {
  const fallback = CATEGORY_FALLBACK_IMAGES[item.categoryId][0];
  return (
    <article className={`swipe-card ${className}`}>
      <img src={item.imageUrl} alt="" draggable={false} onError={(event) => { event.currentTarget.src = fallback; }} />
      <div className="card-image-scrim" />
      <div className="card-content">
        <div className="card-tags">
          {item.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <h2>{item.name}</h2>
        <p>{item.subtitle}</p>
        {item.sourceUrl && (
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" onPointerDown={(event) => event.stopPropagation()}>
            View details <ExternalLink size={14} />
          </a>
        )}
      </div>
    </article>
  );
}

function CompletionView({
  categoryId,
  user,
  partner,
  partnerDone,
  matches,
  yesCount,
  finishing,
  error,
  onRetry,
  onHome,
  onMatches,
}: {
  categoryId: CategoryId;
  user: AppUser;
  partner: AppUser | null;
  partnerDone: boolean;
  matches: PickItem[];
  yesCount: number;
  finishing: boolean;
  error: string;
  onRetry: () => void;
  onHome: () => void;
  onMatches: () => void;
}) {
  const meta = CATEGORY_META[categoryId];
  const bothDone = Boolean(partner && partnerDone);

  if (finishing) {
    return (
      <div className="completion-view completion-loading">
        <div className="completion-spinner"><Heart size={26} fill="currentColor" /></div>
        <span className="eyebrow">Deck complete</span>
        <h1>Comparing your picks…</h1>
        <p>Looking for the little sparks where your yeses overlap.</p>
      </div>
    );
  }

  if (!bothDone) {
    return (
      <div className="completion-view page-enter">
        <div className="waiting-visual">
          <div className="waiting-ring ring-one" />
          <div className="waiting-ring ring-two" />
          <Avatar user={user} />
          <Heart className="waiting-heart" size={21} fill="currentColor" />
          {partner ? <Avatar user={partner} /> : <span className="waiting-unknown">?</span>}
        </div>
        <span className="eyebrow"><CircleCheck size={15} /> Your {meta.label.toLowerCase()} deck is in</span>
        <h1>Good picks. Now we wait<br />for {partner ? firstName(partner.displayName) : "your person"}.</h1>
        <p>You kept {yesCount} {yesCount === 1 ? "option" : "options"} in play. We’ll reveal the overlap as soon as both decks are done.</p>
        {error && <button className="retry-button" type="button" onClick={onRetry}>{error}</button>}
        <button className="primary-button" type="button" onClick={onHome}>Back to the other decks <ArrowRight size={17} /></button>
        <span className="completion-note"><LockKeyhole size={14} /> Your answers stay hidden until you both finish.</span>
      </div>
    );
  }

  return (
    <div className="completion-view match-reveal page-enter">
      <Confetti />
      <span className="match-badge"><Sparkles size={15} /> It’s a match</span>
      <h1>{matches.length ? `You found ${matches.length} shared ${matches.length === 1 ? "yes" : "yeses"}.` : "No overlap—yet."}</h1>
      <p>{matches.length ? "Turns out deciding together can feel this easy." : "That’s useful too. Try another deck or add a few fresh ideas."}</p>
      {matches.length > 0 && (
        <div className="reveal-stack">
          {matches.slice(0, 3).map((item, index) => (
            <article key={item.id} style={{ "--index": index } as CSSProperties}>
              <img src={item.imageUrl} alt="" />
              <div><span>{meta.label}</span><strong>{item.name}</strong><p>{item.subtitle}</p></div>
              <Heart size={18} fill="currentColor" />
            </article>
          ))}
        </div>
      )}
      <div className="completion-actions">
        <button className="primary-button" type="button" onClick={onMatches}>See suitable picks <Trophy size={17} /></button>
        <button className="text-button" type="button" onClick={onHome}>Choose another deck</button>
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--i": index } as CSSProperties} />)}
    </div>
  );
}

function MatchesView({
  state,
  user,
  partner,
  onBack,
  onCategory,
}: {
  state: AppState;
  user: AppUser;
  partner: AppUser | null;
  onBack: () => void;
  onCategory: (categoryId: CategoryId) => void;
}) {
  const ready = partner
    ? CATEGORY_ORDER.filter((id) => hasCompleted(state, user.id, id) && hasCompleted(state, partner.id, id))
    : [];
  const allMatches = ready.flatMap((id) => matchesFor(state, id, partner ? [user, partner] : [user]));

  return (
    <div className="matches-view page-enter">
      <button className="back-link" type="button" onClick={onBack}><ChevronLeft size={18} /> Home</button>
      <header className="matches-header">
        <span className="eyebrow"><Trophy size={15} /> The overlap</span>
        <h1>Suitable picks</h1>
        <p>{allMatches.length ? `You have ${allMatches.length} genuinely mutual ${allMatches.length === 1 ? "option" : "options"} today.` : "Finish the same deck today to reveal what you both want."}</p>
        <div className="match-date"><CalendarDays size={15} /> {formatDay()}</div>
      </header>

      <div className="match-groups">
        {CATEGORY_ORDER.map((categoryId) => {
          const meta = CATEGORY_META[categoryId];
          const Icon = iconByCategory[categoryId];
          const isReady = ready.includes(categoryId);
          const items = partner && isReady ? matchesFor(state, categoryId, [user, partner]) : [];
          return (
            <section className={`match-group ${isReady ? "match-group-ready" : ""}`} key={categoryId}>
              <div className="match-group-heading">
                <span className="category-icon" style={{ background: meta.soft, color: meta.accent }}><Icon size={19} /></span>
                <div><strong>{meta.label}</strong><span>{isReady ? `${items.length} shared ${items.length === 1 ? "yes" : "yeses"}` : "Waiting for both decks"}</span></div>
                {!isReady && <LockKeyhole size={17} />}
              </div>
              {isReady ? (
                items.length ? (
                  <div className="match-list">
                    {items.map((item) => (
                      <article key={item.id}>
                        <img src={item.imageUrl} alt="" />
                        <div><strong>{item.name}</strong><span>{item.subtitle}</span><div>{item.tags.slice(0, 2).map((tag) => <i key={tag}>{tag}</i>)}</div></div>
                        <Heart size={18} fill="currentColor" />
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="no-match-row"><span>No shared yeses in this deck today.</span><button type="button" onClick={() => onCategory(categoryId)}>View deck</button></div>
                )
              ) : (
                <button className="finish-deck-row" type="button" onClick={() => onCategory(categoryId)}>
                  <span>Finish your {meta.label.toLowerCase()} picks</span><ArrowRight size={17} />
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AddView({
  user,
  existingItems,
  onBack,
  onAdd,
}: {
  user: AppUser;
  existingItems: PickItem[];
  onBack: () => void;
  onAdd: (item: PickItem) => Promise<PickItem>;
}) {
  const [categoryId, setCategoryId] = useState<CategoryId>("restaurants");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<LookupResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<LookupResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<PickItem | null>(null);
  const meta = CATEGORY_META[categoryId];
  const isPlace = categoryId !== "watch";

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const found = await searchLookup(query, categoryId, location, controller.signal);
        setResults(found);
        if (!found.length) setSearchError("No exact results yet. Try a more specific name or add it as a custom idea.");
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") {
          setSearchError(reason instanceof Error ? reason.message : "Search is taking a break.");
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 650);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, categoryId, location]);

  function changeCategory(id: CategoryId) {
    setCategoryId(id);
    setResults([]);
    setSelected(null);
    setAdded(null);
    setSearchError("");
  }

  function changeQuery(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
    }
  }

  function customResult(): LookupResult {
    const name = query.trim() || `New ${meta.singular}`;
    return {
      id: `custom-${Date.now()}`,
      categoryId,
      name,
      subtitle: `A custom ${meta.singular} added by ${firstName(user.displayName)}`,
      imageUrl: stableImage(categoryId, name),
      tags: [meta.label, "Your idea"],
      source: "custom",
    };
  }

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const duplicate = existingItems.find(
        (item) =>
          (selected.sourceId && item.sourceId === selected.sourceId && item.source === selected.source) ||
          (item.categoryId === selected.categoryId && item.name.toLowerCase() === selected.name.toLowerCase()),
      );
      if (duplicate) {
        setSearchError(`${duplicate.name} is already in this deck.`);
        setSelected(null);
        return;
      }
      const item: PickItem = {
        ...selected,
        id: selected.source === "custom" ? selected.id : crypto.randomUUID(),
        addedBy: user.id,
        createdAt: new Date().toISOString(),
      };
      const saved = await onAdd(item);
      setAdded(saved);
      setQuery("");
      setResults([]);
      setSelected(null);
    } catch {
      setSearchError("That idea couldn’t be saved just yet. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="add-view page-enter">
      <button className="back-link" type="button" onClick={onBack}><ChevronLeft size={18} /> Home</button>
      <header className="add-heading">
        <span className="eyebrow"><Plus size={15} /> Grow your shared decks</span>
        <h1>Add a new idea</h1>
        <p>Start typing and we’ll find the real place or title—complete with the useful details.</p>
      </header>

      <div className="add-layout">
        <section className="lookup-panel">
          <div className="category-tabs" role="tablist" aria-label="Choose a category">
            {CATEGORY_ORDER.map((id) => {
              const Icon = iconByCategory[id];
              return (
                <button
                  key={id}
                  type="button"
                  className={id === categoryId ? "active" : ""}
                  onClick={() => changeCategory(id)}
                  role="tab"
                  aria-selected={id === categoryId}
                ><Icon size={17} /> {CATEGORY_META[id].label}</button>
              );
            })}
          </div>

          <div className="lookup-fields">
            <label>
              <span>What are you thinking?</span>
              <div className="lookup-input"><Search size={19} /><input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={categoryId === "watch" ? "Search films and TV shows…" : `Search for a ${meta.singular}…`} autoFocus /></div>
            </label>
            {isPlace && (
              <label className="location-field">
                <span>Near <small>(optional)</small></span>
                <div className="lookup-input"><MapPin size={19} /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Town or postcode" /></div>
              </label>
            )}
          </div>

          <div className="lookup-status" aria-live="polite">
            {searching && <span><LoaderCircle className="spin" size={16} /> Looking for the best matches…</span>}
            {!searching && query.length >= 2 && results.length > 0 && <span>{results.length} results found</span>}
          </div>

          <div className="lookup-results">
            {results.map((result) => (
              <button type="button" key={result.id} onClick={() => setSelected(result)}>
                <img src={result.imageUrl} alt="" onError={(event) => { event.currentTarget.src = stableImage(categoryId, result.name); }} />
                <div><strong>{result.name}</strong><span>{result.subtitle}</span><small>{result.tags.slice(0, 2).join(" · ")}</small></div>
                <Plus size={18} />
              </button>
            ))}
          </div>

          {searchError && <p className="search-note"><Info size={15} /> {searchError}</p>}
          {query.trim().length >= 2 && (
            <button className="custom-add" type="button" onClick={() => setSelected(customResult())}>
              <span><Plus size={17} /></span><div><strong>Add “{query.trim()}” as a custom idea</strong><small>You can still add anything the lookup can’t find.</small></div><ArrowRight size={17} />
            </button>
          )}

          {!query && (
            <div className="lookup-empty">
              <Search size={25} />
              <strong>Search, select, done.</strong>
              <p>We’ll bring across a proper name, image and useful details so every card feels complete.</p>
            </div>
          )}
        </section>

        <aside className="add-preview">
          {added ? (
            <div className="added-success">
              <span><Check size={24} /></span>
              <p className="eyebrow">Added for good</p>
              <h2>{added.name}</h2>
              <p>It’s now waiting in your {CATEGORY_META[added.categoryId].label.toLowerCase()} deck for both of you.</p>
              <button type="button" onClick={() => setAdded(null)}>Add another <Plus size={16} /></button>
            </div>
          ) : selected ? (
            <div className="selected-preview">
              <img src={selected.imageUrl} alt="" />
              <div className="selected-copy">
                <span className="eyebrow">Ready to add</span>
                <h2>{selected.name}</h2>
                <p>{selected.subtitle}</p>
                <div className="selected-tags">{selected.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
                <button className="primary-button" type="button" onClick={save} disabled={saving}>
                  {saving ? <><LoaderCircle className="spin" size={17} /> Saving…</> : <><Plus size={17} /> Add to shared deck</>}
                </button>
                <button className="text-button" type="button" onClick={() => setSelected(null)}>Choose something else</button>
              </div>
            </div>
          ) : (
            <div className="preview-placeholder">
              <div className="placeholder-stack"><span /><span /><span><Heart size={25} /></span></div>
              <h2>Your next favourite thing could start here.</h2>
              <p>Select a result and we’ll show you exactly how it will look in the deck.</p>
            </div>
          )}
        </aside>
      </div>
      <p className="lookup-attribution">Place search by OpenStreetMap · TV search by TVmaze · Optional TMDB support included</p>
    </div>
  );
}

function BottomNav({ view, onView }: { view: View; onView: (view: View) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <button type="button" className={view === "home" ? "active" : ""} onClick={() => onView("home")}><Home size={19} /><span>Home</span></button>
      <button type="button" className={view === "matches" ? "active" : ""} onClick={() => onView("matches")}><Trophy size={19} /><span>Matches</span></button>
      <button type="button" className="nav-add" onClick={() => onView("add")} aria-label="Add an idea"><Plus size={24} /></button>
      <button type="button" className={view === "add" ? "active" : ""} onClick={() => onView("add")}><Search size={19} /><span>Discover</span></button>
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Clock3 size={19} /><span>Today</span></button>
    </nav>
  );
}
