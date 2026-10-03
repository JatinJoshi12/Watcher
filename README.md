# Watcher

A cinematic movie and web-series discovery and personal watch-list application built with React + Vite, Supabase, and TMDB.

## Current Product Structure

- **Home**: Watch. Discover. Repeat. with upcoming movies, upcoming web series, latest trailers/teasers, top movies, and top series.
- **My Watch List**: Create, edit, delete, and open unlimited named collections.
- **Inside a Watch List**: Search TMDB titles without leaving the list, with instant results while typing; filter only by status and genre; sort by recently added and related options.
- **Discover**: Large cinematic search, separate Movies and Web Series sections, genre browsing, and Show More pagination.
- **Settings**: Edit display name, profile avatar, view email, save profile changes, and log out.

## Visual System

The app uses a dark cinematic presentation with bold Manrope/DM Sans typography, gold accents, strong shadows, subtle motion, and supplied movie-collage backgrounds across the authenticated pages.

## Environment Variables

Create `.env`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_TMDB_API_TOKEN=
```

## Run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Supabase

Run `supabase/schema.sql` in the Supabase SQL Editor. Keep Row Level Security enabled. Do not expose service-role or secret keys in the frontend.

## TMDB

The application uses TMDB for in-site movie/TV discovery, upcoming releases, trending titles, and recent trailers/teasers .

## Included Background Assets

- `public/topbar-background.png` from supplied image 1
- `public/watchlists-background.png` from supplied image 2
- `public/watchlist-background.png` from supplied image 3
- `public/modal-background.png` from supplied image 4
- `public/discover-background.png` from supplied image 3
- `public/settings-background.png` from supplied image 4
- `public/login-background.png` retained for the existing login experience

## Install As An App

Watcher includes a web app manifest, app icons, standalone display mode, and a service worker. After deployment over HTTPS, use your browser's **Install App** / **Add To Home Screen** option. The installed shortcut opens Watcher as a standalone app rather than a normal browser tab.
