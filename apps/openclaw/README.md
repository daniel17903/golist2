# OpenClaw integration assets

This folder contains an OpenClaw skill for managing GoList lists through the backend API.

- `SKILL.md`: operational instructions and constraints for OpenClaw.

The skill uses the fixed API base URL `https://go-list.app/api`, generates/persists its own device UUID, supports optional share-token bootstrapping, can create and switch between lists, persists known list IDs/names offline, and avoids icon/category mapping by default.
