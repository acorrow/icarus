# Pirate Radio Configuration

The Pirate Radio panel inside GhostNet streams audio playlists assembled from two directory roots. The service stores these path selections inside the platform-specific `Preferences.json` so commanders only have to configure them once:

- **Library directory** – the curated music or community submissions that provide the primary playlist.
- **Commercial directory** – optional station advertising or bumpers that can be slotted between tracks. Commercials are shuffled separately and inserted after a configurable number of library tracks (default cadence: every two songs).

Supported file extensions include `.mp3`, `.ogg`/`.oga`/`.opus`, `.flac`, `.wav`, `.aac`, and `.m4a`. The backend reads ID3/Vorbis metadata with [`music-metadata`](https://github.com/Borewit/music-metadata) to populate titles, artists, albums, and durations. Files without readable tags fall back to the filename and standard "Unknown" labels.

The frontend requests playlist data from the service through the following socket events:

- `getPirateRadioPlaylist` – returns the current queue, directory metadata, and backend status messages.
- `rescanPirateRadio` – instructs the backend to rescan the configured directories and rebuild the playlist.
- `setPirateRadioDirectories` – persists a new library or commercial path. The event payload includes the directory type and the current path so the picker can start from the existing location.

When either directory changes, or when a rescan completes, the service broadcasts the updated state to the client via `pirateRadioUpdate` (and `pirateRadioDirectoriesUpdated` if directory-specific metadata changes). The panel listens for both events and updates the queue automatically.

### Streaming endpoint

Audio playback originates from `GET /pirate-radio/stream?id=<trackId>`. Requests must supply the playlist track identifier; the service validates the ID against the cached playlist map and responds with:

- `200 OK` for full downloads with `Content-Type` inferred from the file extension and `Accept-Ranges: bytes`.
- `206 Partial Content` when a valid `Range: bytes=start-end` header is provided. Invalid ranges return `416`.
- `404 Not Found` if the ID does not match the cached playlist or the file is missing on disk.

Clients should rely on the cached playlist metadata for durations and track ordering; the HTTP endpoint is designed solely for streaming and does not expose filesystem structure directly.

### Usage

1. Open the **Pirate Radio** tab within GhostNet.
2. Use the **Browse Library** and **Browse Commercials** buttons to select folders containing audio files. Each button triggers the `setPirateRadioDirectories` socket handler with the selected directory type.
3. Click **Rescan Library** to issue `rescanPirateRadio` and rebuild the playlist. A toast and inline banner confirm whether the rescan succeeded.
4. Playback controls (Play/Pause/Prev/Next) drive the panel’s internal `<audio>` element. When a track ends the panel automatically advances to the next entry in the queue.

The UI surfaces inline status banners for both success and error states while also emitting toast notifications through the shared GhostNet notification helper. The current directories, backend status messages, and last successful scan timestamp remain visible so commanders can diagnose missing or invalid folders quickly.
