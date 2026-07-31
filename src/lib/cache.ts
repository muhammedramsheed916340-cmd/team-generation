/**
 * In-memory cache service (Redis-like interface)
 * Provides TTL, LRU eviction, namespacing, and hit/miss metrics.
 * Used by: match sync, playing XI, generated teams, sessions.
 */

type CacheEntry<T> = {
  value: T
  expiresAt: number // epoch ms, 0 = never
  lastAccessed: number
  hits: number
}

type CacheStats = {
  hits: number
  misses: number
  sets: number
  deletes: number
  evictions: number
  size: number
}

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_ENTRIES = 1000

class CacheStore {
  private store = new Map<string, CacheEntry<unknown>>()
  private stats: CacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0, size: 0 }

  private touch(key: string, entry: CacheEntry<unknown>) {
    entry.lastAccessed = Date.now()
    entry.hits++
  }

  private evictIfNeeded() {
    if (this.store.size > MAX_ENTRIES) {
      // LRU eviction: remove least recently accessed
      let oldestKey: string | null = null
      let oldestTime = Infinity
      for (const [k, v] of this.store) {
        if (v.lastAccessed < oldestTime) {
          oldestTime = v.lastAccessed
          oldestKey = k
        }
      }
      if (oldestKey) {
        this.store.delete(oldestKey)
        this.stats.evictions++
      }
    }
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) {
      this.stats.misses++
      return null
    }
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.stats.misses++
      return null
    }
    this.touch(key, entry)
    this.stats.hits++
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL): void {
    this.evictIfNeeded()
    this.store.set(key, {
      value,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
      lastAccessed: Date.now(),
      hits: 0,
    })
    this.stats.sets++
    this.stats.size = this.store.size
  }

  delete(key: string): boolean {
    const deleted = this.store.delete(key)
    if (deleted) this.stats.deletes++
    this.stats.size = this.store.size
    return deleted
  }

  has(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return false
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return false
    }
    return true
  }

  clear(prefix?: string): void {
    if (!prefix) {
      this.store.clear()
    } else {
      for (const key of this.store.keys()) {
        if (key.startsWith(prefix)) this.store.delete(key)
      }
    }
    this.stats.size = this.store.size
  }

  keys(prefix?: string): string[] {
    const all = [...this.store.keys()]
    return prefix ? all.filter((k) => k.startsWith(prefix)) : all
  }

  stats_snapshot(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
    }
  }

  /** Cache-aside helper: get-or-set with a loader function */
  async getOrSet<T>(key: string, loader: () => Promise<T>, ttlMs: number = DEFAULT_TTL): Promise<T> {
    const existing = this.get<T>(key)
    if (existing !== null) return existing
    const fresh = await loader()
    this.set(key, fresh, ttlMs)
    return fresh
  }
}

// Singleton cache instance with namespaces
export const cache = new CacheStore()

// Namespace helpers
export const cacheKeys = {
  match: (id: string) => `match:${id}`,
  matchList: (status?: string) => `matches:${status || 'all'}`,
  playingXI: (matchId: string) => `xi:${matchId}`,
  players: (matchId: string) => `players:${matchId}`,
  generatedTeams: (matchId: string, strategy: string) => `teams:${matchId}:${strategy}`,
  user: (id: string) => `user:${id}`,
  subscription: (userId: string) => `sub:${userId}`,
  license: (key: string) => `license:${key}`,
  metrics: 'metrics:dashboard',
}

export const cacheTTL = {
  short: 30 * 1000, // 30s
  medium: 5 * 60 * 1000, // 5m
  long: 30 * 60 * 1000, // 30m
  match: 60 * 1000, // 1m (live data)
  xi: 2 * 60 * 1000, // 2m
  teams: 10 * 60 * 1000, // 10m
}
