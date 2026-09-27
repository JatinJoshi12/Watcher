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

The application uses TMDB for in-site movie/TV discovery, upcoming releases, trending titles, and recent trailers/teasers.

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

## Browser Streaming Integration

Watcher can query configured Stremio-compatible HTTP/HLS addons from the title detail page. The player only attempts browser media URLs and automatically falls back to the next candidate when a source fails. Series titles expose season and episode selectors, and the OpenSubtitles PRO addon can supply subtitle tracks.

For PenguPlay, store your own authenticated manifest URL in `VITE_PENGUPLAY_MANIFEST_URL` or enter it under Settings. Do not commit an authenticated manifest URL or token to source control.

## Dependency note

`node_modules` is intentionally not included in the project ZIP. Install dependencies on the machine where you run Watcher so npm selects the correct native packages for that operating system.

If Windows shows a Rolldown/Vite native-binding error, close the dev server, remove the local `node_modules` folder, and run:

```powershell
Remove-Item -Recurse -Force node_modules
npm cache verify
npm install --include=optional
npm run dev
```

Do not copy `node_modules` from another operating system into this project.

## Streaming Integration Notes

Watcher treats direct HTTP(S) stream URLs as playback candidates and lets the browser/player validate the source at runtime. Stremio `infoHash`/torrent-only results are not treated as direct browser media. Provider preference is PenguPlay first, HdHub second, then Showbox, WebStreamrMBG, and Flix-Streams Free.

For a series, the stream request uses the selected season and episode. Subtitle discovery is independent of source discovery so it does not delay first playback.

Set `VITE_PENGUPLAY_MANIFEST_URL` to your current private authenticated PenguPlay manifest URL. Do not commit or share that value.
