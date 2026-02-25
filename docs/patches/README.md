# Saved patch snapshots

This folder stores patch snapshots generated during Codex sessions.

- `undone-i18n-changes.patch` contains the full patch of the reverted commit that previously attempted the i18n/settings changes. It was generated with:
  - `git format-patch -1 HEAD --stdout > /tmp/golist2-last-changes.patch`
  - then copied into this repository for visibility/review in branch diffs.
