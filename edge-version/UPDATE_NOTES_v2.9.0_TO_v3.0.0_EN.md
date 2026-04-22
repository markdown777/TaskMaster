# TaskMaster v3.0.0 Release Notes (Upgrade from v2.9.0)

Generated at 2026-04-22 11:24:07 (Asia/Shanghai)

Hello users and reviewers,

TaskMaster v3.0.0 is our biggest architectural and UI upgrade so far, focused on storage limits, stability, and backups.

## Key Highlights

### 1. Break storage limits: Hybrid Sync + Local architecture
- Background: In v2.9.0, all tasks were stored in `chrome.storage.sync`. Because Sync storage has strict quotas (8KB per item, about 100KB total), power users could hit `QUOTA_BYTES_PER_ITEM`, risking data loss.
- Upgrade: v3.0.0 introduces a hybrid approach: core task data in Sync and full task data in Local.
- Smooth migration: After upgrading to v3.0.0, the background service automatically detects legacy Sync tasks and migrates them to Local storage. Sync storage is freed, and only lightweight fields are kept in Sync for cross-device merge.

### 2. New capability: Service Worker silent auto-backup
- Why: Users often forget manual backups.
- How: Using Manifest V3 `chrome.alarms`, TaskMaster runs a 24-hour rolling backup schedule in the background.
- Snapshot retention: A full data snapshot is generated daily and stored in Local storage (defaults to the latest 7 days).
- Upgrade guidance: When upgrading from v2.9.0, TaskMaster performs an immediate snapshot backup and opens the Settings page to guide users to export a manual JSON backup for extra safety.

### 3. UI and interaction redesign (Typography First)
- Minimal visual language: Removes card clutter, heavy shadows, and ornamental highlight patterns. The new UI is typography and whitespace driven.
- Interaction polish: Improves rendering behavior to avoid losing scroll position and collapse states caused by full `innerHTML` rerenders. Hover/focus transitions use `cubic-bezier(0.16, 1, 0.3, 1)` for a natural feel.
- Internationalization: Adds standard `_locales` (i18n) support for English (`en`) and Simplified Chinese (`zh_CN`).

### 4. Performance and security fixes
- Event binding leak fixed: Moves repeated event bindings out of rendering flows into one-time delegated listeners to reduce CPU usage and prevent duplicate triggers.
- XSS protection hardened: Strengthens HTML escaping for both text and attribute injection points (including quotes).
- Import/Export encryption fixed: Fixes Options-page import/export failures caused by calling missing sync encryption helpers.

---

## Notes for Edge review
1. This extension follows Manifest V3 requirements.
2. The `downloads` permission is requested only to support user-initiated JSON export (manual backup) and backup recovery workflows.
3. All requests and storage operations stay in the browser (local storage and Edge Sync). No third-party tracking or analytics.

