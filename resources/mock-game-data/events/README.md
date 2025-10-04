# Mock Event Data Strategy for CODEX

This folder contains mock data files for each major Elite Dangerous journal event type. Each file includes multiple entries, covering common, edge, and rare cases. This structure allows CODEX to develop and test ingestion, normalization, and event handling strategies just as it would with real game logs.

## Why This Structure?
- **Explicit event separation:** Each file contains only one event type, making it easy to target, update, and extend.
- **Multiple entries per file:** Ensures coverage of typical, edge, and rare cases for robust testing.
- **Mirrors real log ingestion:** CODEX can iterate over files as if reading actual logs, but with curated, decision-driven examples.
- **Clear rationale:** Data chosen to maximize coverage, highlight edge cases, and expose rare structures that may break naive parsers.

## How to Use
- Treat each file as a source of canonical examples for its event type.
- Extend files with new cases as needed, but keep rationale clear in comments or commit messages.
- Use this folder to validate event normalization, error handling, and downstream logic.

## Example Files
- `ShipLocker.json`: Empty and populated lockers.
- `FSSSignalDiscovered.json`: Stations, carriers, installations, rare signal types.
- `Docked.json`: Full station metadata, services, economies, edge cases.
- `MiningRefined.json`: Multiple minerals, rare types.
- `MaterialCollected.json`: Common and rare materials.

## Next Steps
- Add more event types as needed.
- Document rationale for new edge cases in each file.
- Use this structure for all CODEX mock data development and testing.
