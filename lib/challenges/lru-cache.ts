import type { Challenge } from "../types";

const jsContent = `class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) {
      return undefined;
    }
    return this.map.get(key);
  }

  put(key, value) {
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const newestKey = Array.from(this.map.keys()).pop();
      this.map.delete(newestKey);
    }
  }

  has(key) {
    return this.map.has(key);
  }

  size() {
    return this.map.size;
  }
}

module.exports = { LRUCache };
`;

const tsContent = `export class LRUCache<K, V> {
  private capacity: number;
  private map = new Map<K, V>();

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) {
      return undefined;
    }
    return this.map.get(key);
  }

  put(key: K, value: V): void {
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const newestKey = Array.from(this.map.keys()).pop();
      if (newestKey !== undefined) {
        this.map.delete(newestKey);
      }
    }
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  size(): number {
    return this.map.size;
  }
}
`;

const pyContent = `class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.store = {}

    def get(self, key):
        if key not in self.store:
            return None
        return self.store[key]

    def put(self, key, value):
        self.store[key] = value
        if len(self.store) > self.capacity:
            newest_key = list(self.store.keys())[-1]
            del self.store[newest_key]

    def has(self, key):
        return key in self.store

    def size(self):
        return len(self.store)
`;

export const lruCache: Challenge = {
  id: "lru-cache",
  title: "LRU Cache implementation",
  summary:
    "A classic data-structure review: an LRU cache that looks plausible but gets recency tracking and eviction wrong. Tests whether the candidate actually knows what 'least recently used' means.",
  prTitle: "Add LRUCache for the session lookup hot path",
  prDescription:
    "This PR adds a small LRU cache we'll use to memoize session lookups. " +
    "It keeps at most `capacity` entries and evicts when full. " +
    "Please review as you would a normal PR — leave comments on any lines you have concerns about.",
  fixInstructions:
    "Now fix the implementation so it behaves as a correct LRU cache: reads and writes must mark an entry as most-recently-used, and eviction must remove the least-recently-used entry. Keep the public API the same.",
  findings: [
    {
      id: "lru-get-no-touch",
      title: "get() does not update recency",
      description:
        "Reading a key must mark it as most-recently-used (e.g. delete and re-insert in the Map/dict). As written, a frequently-read key can still be evicted, so this is not an LRU cache.",
      category: "bug",
      severity: "critical",
    },
    {
      id: "lru-evicts-newest",
      title: "Eviction removes the newest entry, not the least recently used",
      description:
        "Eviction takes the LAST key in insertion order — the entry that was just added — instead of the first (oldest). The cache evicts exactly the wrong element. Building the whole key list is also O(n) when the first key is available directly from the iterator.",
      category: "bug",
      severity: "critical",
    },
    {
      id: "lru-put-existing",
      title: "put() on an existing key does not refresh its position",
      description:
        "Setting an existing key in a Map/dict keeps its original insertion position, so updating a key does not mark it as recently used. It should be deleted and re-inserted (or moved to the end).",
      category: "bug",
      severity: "major",
    },
    {
      id: "lru-capacity-validation",
      title: "Capacity is not validated",
      description:
        "A capacity of 0 or a negative number is accepted silently and produces a cache that immediately evicts everything. The constructor should reject non-positive capacities.",
      category: "design",
      severity: "minor",
    },
  ],
  variants: {
    javascript: {
      language: "javascript",
      files: [{ path: "src/lru-cache.js", content: jsContent }],
      anchors: {
        "lru-get-no-touch": {
          file: "src/lru-cache.js",
          anchor: "return this.map.get(key);",
        },
        "lru-evicts-newest": {
          file: "src/lru-cache.js",
          anchor: "Array.from(this.map.keys()).pop()",
        },
        "lru-put-existing": {
          file: "src/lru-cache.js",
          anchor: "this.map.set(key, value);",
        },
        "lru-capacity-validation": {
          file: "src/lru-cache.js",
          anchor: "this.capacity = capacity;",
        },
      },
    },
    typescript: {
      language: "typescript",
      files: [{ path: "src/lru-cache.ts", content: tsContent }],
      anchors: {
        "lru-get-no-touch": {
          file: "src/lru-cache.ts",
          anchor: "return this.map.get(key);",
        },
        "lru-evicts-newest": {
          file: "src/lru-cache.ts",
          anchor: "Array.from(this.map.keys()).pop()",
        },
        "lru-put-existing": {
          file: "src/lru-cache.ts",
          anchor: "this.map.set(key, value);",
        },
        "lru-capacity-validation": {
          file: "src/lru-cache.ts",
          anchor: "this.capacity = capacity;",
        },
      },
    },
    python: {
      language: "python",
      files: [{ path: "src/lru_cache.py", content: pyContent }],
      anchors: {
        "lru-get-no-touch": {
          file: "src/lru_cache.py",
          anchor: "return self.store[key]",
        },
        "lru-evicts-newest": {
          file: "src/lru_cache.py",
          anchor: "list(self.store.keys())[-1]",
        },
        "lru-put-existing": {
          file: "src/lru_cache.py",
          anchor: "self.store[key] = value",
        },
        "lru-capacity-validation": {
          file: "src/lru_cache.py",
          anchor: "self.capacity = capacity",
        },
      },
    },
  },
};
