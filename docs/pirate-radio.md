# Pirate Radio Configuration

The Pirate Radio panel inside GhostNet streams audio playlists assembled from two directory roots:

- **Library directory** – the curated music or community submissions that provide the primary playlist.
- **Commercial directory** – optional station advertising or bumpers that can be slotted between tracks.

The frontend requests playlist data from the service through the following socket events:

- `getPirateRadioStatus` – returns the cached scan results and directory metadata.
- `rescanPirateRadio` – instructs the backend to rescan the configured directories and rebuild the playlist cache.
- `setPirateRadioDirectories` – persists a new library or commercial directory and triggers a rescan when the path changes.

When either directory changes, or when a rescan completes, the service broadcasts the updated state via `pirateRadioDirectoriesUpdated`. The panel listens for this event and updates the queue automatically.

### Usage

1. Open the **Pirate Radio** tab within GhostNet.
2. Use the **Browse Library** and **Browse Commercials** buttons to select folders containing audio files. Each button triggers the `setPirateRadioDirectories` socket handler with the selected directory type.
3. Click **Rescan Library** to issue `rescanPirateRadio` and rebuild the playlist. A toast and inline banner confirm whether the rescan succeeded.
4. Playback controls (Play/Pause/Prev/Next) drive the panel’s internal `<audio>` element. When a track ends the panel automatically advances to the next entry in the queue.

The UI surfaces inline status banners for both success and error states while also emitting toast notifications through the shared GhostNet notification helper. The current directories and any backend status messages remain visible so commanders can diagnose missing or invalid folders quickly.
