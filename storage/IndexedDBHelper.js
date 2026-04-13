if (typeof window.IndexedDBHelper === 'undefined') {
  window.IndexedDBHelper = class IndexedDBHelper {

    constructor(dbName = 'CodeExtractorDB', version = 3) {
      this.dbName = dbName;
      this.version = version;
      this.db = null;
      this.stores = {
        projects: {
          name: 'projects',
          keyPath: 'id',
          indexes: [
            { name: 'by_source', keyPath: 'sourceSite' },
            { name: 'by_created', keyPath: 'createdAt' },
            { name: 'by_name', keyPath: 'name' },
            { name: 'by_favorite', keyPath: 'isFavorite' },
            { name: 'by_language', keyPath: 'languages', options: { multiEntry: true } }
          ]
        },
        files: {
          name: 'files',
          keyPath: 'id',
          indexes: [
            { name: 'by_project', keyPath: 'projectId' },
            { name: 'by_language', keyPath: 'language' },
            { name: 'by_name', keyPath: 'name' },
            { name: 'by_path', keyPath: 'path' }
          ]
        },
        metadata: {
          name: 'metadata',
          keyPath: 'key',
          indexes: []
        },
        version_history: {
          name: 'version_history',
          keyPath: 'id',
          indexes: [
            { name: 'by_project', keyPath: 'projectId' },
            { name: 'by_file', keyPath: 'filePath' },
            { name: 'by_timestamp', keyPath: 'timestamp' },
            { name: 'by_project_file', keyPath: ['projectId', 'filePath'] },
            { name: 'by_favorite', keyPath: 'isFavorite' },
            { name: 'by_change_type', keyPath: 'changeType' }
          ]
        },
        templates: {
          name: 'templates',
          keyPath: 'id',
          indexes: [
            { name: 'by_category', keyPath: 'category' },
            { name: 'by_language', keyPath: 'language' },
            { name: 'by_name', keyPath: 'name' },
            { name: 'by_custom', keyPath: 'isCustom' }
          ]
        },
        search_index: {
          name: 'search_index',
          keyPath: 'id',
          indexes: [
            { name: 'by_type', keyPath: 'type' },
            { name: 'by_project', keyPath: 'projectId' },
            { name: 'by_language', keyPath: 'language' }
          ]
        },
        teams: {
          name: 'teams',
          keyPath: 'id',
          indexes: [
            { name: 'by_owner', keyPath: 'ownerId' },
            { name: 'by_name', keyPath: 'name' }
          ]
        },
        invites: {
          name: 'invites',
          keyPath: 'id',
          indexes: [
            { name: 'by_team', keyPath: 'teamId' },
            { name: 'by_code', keyPath: 'code' },
            { name: 'by_status', keyPath: 'status' }
          ]
        },
        custom_parsers: {
          name: 'custom_parsers',
          keyPath: 'id',
          indexes: [
            { name: 'by_name', keyPath: 'name' },
            { name: 'by_enabled', keyPath: 'isEnabled' }
          ]
        },
        deployments: {
          name: 'deployments',
          keyPath: 'id',
          indexes: [
            { name: 'by_platform', keyPath: 'platform' },
            { name: 'by_deployed', keyPath: 'deployedAt' },
            { name: 'by_project', keyPath: 'projectName' }
          ]
        },
        team_changes: {
          name: 'team_changes',
          keyPath: 'id',
          indexes: [
            { name: 'by_team', keyPath: 'teamId' },
            { name: 'by_user', keyPath: 'userId' },
            { name: 'by_timestamp', keyPath: 'timestamp' }
          ]
        }
      };
    }

    async open() {
      if (this.db) return this.db;

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => {
          reject(new Error(`IndexedDB open failed: ${request.error?.message || 'Unknown error'}`));
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          const oldVersion = event.oldVersion;
          const transaction = event.target.transaction;

          // CRITICAL: Call createStores FIRST to ensure all stores defined in this.stores exist.
          // This prevents 'Transaction aborted' errors when upgrades try to access missing stores.
          this.createStores(db, transaction);

          if (oldVersion < 2) {
            this.upgradeFromV1ToV2(db, transaction);
          }
          if (oldVersion < 3) {
            this.upgradeFromV2ToV3(db, transaction);
          }
        };
      });
    }

    createStores(db, transaction) {
      for (const [storeName, config] of Object.entries(this.stores)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: config.keyPath });
          for (const index of config.indexes) {
            store.createIndex(index.name, index.keyPath, index.options || {});
          }

          if (storeName === 'metadata') {
            // Initialize metadata on creation
            store.add({ key: 'dbVersion', value: this.version });
            store.add({ key: 'totalProjects', value: 0 });
            store.add({ key: 'installDate', value: Date.now() });
          }
        }
      }
    }

    upgradeFromV1ToV2(db, transaction) {
      if (!db.objectStoreNames.contains('version_history')) {
        const vhStore = db.createObjectStore('version_history', { keyPath: 'id' });
        vhStore.createIndex('by_project', 'projectId');
        vhStore.createIndex('by_file', 'filePath');
        vhStore.createIndex('by_timestamp', 'timestamp');
        vhStore.createIndex('by_favorite', 'isFavorite');
        vhStore.createIndex('by_change_type', 'changeType');
      }

      if (!db.objectStoreNames.contains('templates')) {
        const tplStore = db.createObjectStore('templates', { keyPath: 'id' });
        tplStore.createIndex('by_category', 'category');
        tplStore.createIndex('by_language', 'language');
        tplStore.createIndex('by_name', 'name');
        tplStore.createIndex('by_custom', 'isCustom');
      }

      if (!db.objectStoreNames.contains('search_index')) {
        const siStore = db.createObjectStore('search_index', { keyPath: 'id' });
        siStore.createIndex('by_type', 'type');
        siStore.createIndex('by_project', 'projectId');
        siStore.createIndex('by_language', 'language');
      }

      // Use transaction provided by upgradeneeded
      if (db.objectStoreNames.contains('metadata')) {
        const metaStore = transaction.objectStore('metadata');
        metaStore.put({ key: 'dbVersion', value: 2 });
        metaStore.put({ key: 'v2UpgradeDate', value: Date.now() });
      }
    }

    upgradeFromV2ToV3(db, transaction) {
      if (!db.objectStoreNames.contains('teams')) {
        const teamStore = db.createObjectStore('teams', { keyPath: 'id' });
        teamStore.createIndex('by_owner', 'ownerId');
        teamStore.createIndex('by_name', 'name');
      }

      if (!db.objectStoreNames.contains('invites')) {
        const inviteStore = db.createObjectStore('invites', { keyPath: 'id' });
        inviteStore.createIndex('by_team', 'teamId');
        inviteStore.createIndex('by_code', 'code');
        inviteStore.createIndex('by_status', 'status');
      }

      if (!db.objectStoreNames.contains('custom_parsers')) {
        const parserStore = db.createObjectStore('custom_parsers', { keyPath: 'id' });
        parserStore.createIndex('by_name', 'name');
        parserStore.createIndex('by_enabled', 'isEnabled');
      }

      if (!db.objectStoreNames.contains('deployments')) {
        const deployStore = db.createObjectStore('deployments', { keyPath: 'id' });
        deployStore.createIndex('by_platform', 'platform');
        deployStore.createIndex('by_deployed', 'deployedAt');
        deployStore.createIndex('by_project', 'projectName');
      }

      if (!db.objectStoreNames.contains('team_changes')) {
        const changeStore = db.createObjectStore('team_changes', { keyPath: 'id' });
        changeStore.createIndex('by_team', 'teamId');
        changeStore.createIndex('by_user', 'userId');
        changeStore.createIndex('by_timestamp', 'timestamp');
      }

      if (db.objectStoreNames.contains('metadata')) {
        const metaStore = transaction.objectStore('metadata');
        metaStore.put({ key: 'dbVersion', value: 3 });
        metaStore.put({ key: 'v3UpgradeDate', value: Date.now() });
      }
    }

    async add(storeName, data) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Add failed: ${request.error?.message}`));
      });
    }

    async get(storeName, id) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(new Error(`Get failed: ${request.error?.message}`));
      });
    }

    async getAll(storeName) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(`GetAll failed: ${request.error?.message}`));
      });
    }

    async update(storeName, data) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Update failed: ${request.error?.message}`));
      });
    }

    async delete(storeName, id) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(new Error(`Delete failed: ${request.error?.message}`));
      });
    }

    async query(storeName, indexName, value) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(`Query failed: ${request.error?.message}`));
      });
    }

    async queryRange(storeName, indexName, lower, upper, direction = 'prev') {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const range = IDBKeyRange.bound(lower, upper, false, false);
        const request = index.getAll(range, undefined, direction);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(`QueryRange failed: ${request.error?.message}`));
      });
    }

    async paginate(storeName, offset = 0, limit = 20, indexName = null, direction = 'prev') {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = indexName ? tx.objectStore(storeName).index(indexName) : tx.objectStore(storeName);
        const request = store.openCursor(null, direction);
        const results = [];
        let count = 0;
        let skipped = 0;

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) {
            resolve({ items: results, total: count, hasMore: false });
            return;
          }

          count++;

          if (skipped < offset) {
            skipped++;
            cursor.continue();
            return;
          }

          if (results.length >= limit) {
            resolve({ items: results, total: count, hasMore: true });
            return;
          }

          results.push(cursor.value);
          cursor.continue();
        };

        request.onerror = () => reject(new Error(`Paginate failed: ${request.error?.message}`));
      });
    }

    async clear(storeName) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(new Error(`Clear failed: ${request.error?.message}`));
      });
    }

    async count(storeName) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Count failed: ${request.error?.message}`));
      });
    }

    async batchAdd(storeName, items) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        for (const item of items) {
          store.put(item);
        }

        tx.oncomplete = () => resolve(items.length);
        tx.onerror = () => reject(new Error(`BatchAdd failed: ${tx.error?.message}`));
      });
    }

    async close() {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
    }

    async deleteDatabase() {
      this.close();
      return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(this.dbName);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(new Error(`DeleteDatabase failed: ${request.error?.message}`));
      });
    }

    async getStorageStats() {
      if (!this.db) await this.open();
      const stats = {};
      for (const storeName of Object.keys(this.stores)) {
        try {
          stats[storeName] = await this.count(storeName);
        } catch (e) {
          stats[storeName] = 0;
        }
      }
      return stats;
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { IndexedDBHelper: window.IndexedDBHelper };
}
