# DoneLog — Home Chore & Proof Tracker

A clean, mobile-friendly web app hosted 100% free on **GitHub Pages** with **free GitHub Gist PC ↔ Phone Cloud Sync** — log what you did, when you did it, attach photo proofs, and share a read-only link with your brother.

## Features
- **100% Free Forever on GitHub Pages**: Zero hosting costs or credit limits; works seamlessly on PC and phone (installable to your phone's home screen via PWA manifest).
- **Free GitHub Gist PC ↔ Phone Cloud Sync**: Syncs all chores, timestamps, notes, quick-pick presets, and compressed photo proofs across devices using a private GitHub Gist (`donelog-sync-vault.json` + per-photo files). You can even reuse your existing `gist` token!
- **Read-Only Share Link for Your Brother**: Copy a `?view=<gistId>` link so your brother can open your live chore history and photo proofs on his phone without signing in — and without being able to edit or delete anything.
- **Quick-Pick Chores**: Tap common chores (including *Cleaned bedroom*, *Washed dishes*, *Took out trash*, etc.) or customize your own list.
- **Offline-Ready Local Cache**: Saves immediately to IndexedDB and merges cleanly across devices when syncing.

## Local Preview
```bash
python3 -m http.server 8080
```
Then open `http://localhost:8080`.
