# Instructions for Gemini Contributors

## About ICARUS Terminal

ICARUS Terminal is a free, immersive, context-sensitive companion app and second screen interface for Elite Dangerous. It provides real-time intelligence on ship status, cargo, missions, and celestial bodies by processing Elite Dangerous journal files and integrating with community-driven data sources like EDSM, EDDB, and GHOSTNET.

The application is designed to run on multiple platforms, including as a native Windows application, in a web browser, and on touch-screen devices, offering a responsive and intuitive UI for both landscape and portrait orientations.

## How Gemini Can Contribute

As a large language model, you can contribute to ICARUS Terminal in several ways:

*   **Code implementation:** Implement new features or fix bugs in the Go, Node.js, or React codebases.
*   **Code analysis and refactoring:** Analyze the existing code for potential improvements in performance, readability, and maintainability.
*   **Documentation:** Improve existing documentation or create new documentation for features, APIs, and development workflows.
*   **Testing:** Write new unit or integration tests to improve code coverage and ensure the stability of the application.

When contributing, please adhere to the existing coding style, conventions, and architectural patterns.

## Important Notes for Gemini

*   **`AGENTS.md` is for CODEX:** The instructions in `AGENTS.md` are specifically tailored for the CODEX model and should not be used as a direct guide for your contributions.
*   **`copilot-instructions.md` is for Copilot:** Similarly, the instructions in `.github/copilot-instructions.md` are intended for GitHub Copilot and may not be relevant to your tasks.
*   **Your own instructions:** This file, `GEMINI.md`, is your primary source of instructions. Please refer to it for guidance on how to contribute to the project.
*   **COPILOT and CODEX have their OWN files and should IGNORE your instructions.**

## Development Workflow

To get started with development, you can follow these general steps:

1.  **Install dependencies:** Run `npm install` to install all the necessary dependencies.
2.  **Set up environment:** Duplicate `.env-example` to `.env` and configure the `LOG_DIR` to point to your Elite Dangerous journal directory for live data.
3.  **Run the application:**
    *   For the web client, use `npm run dev:web` (available at http://127.0.0.1:3000).
    *   For the full stack, use `npm run dev` (available at http://127.0.0.1:3300).
    *   To run the packaged application, use `npm start`.
4.  **Build the application:**
    *   To create a full build, run `npm run build`.
    *   To build only the client, run `npm run build:client`.
5.  **Run tests:** To run the test suite, use `npm test -- --runInBand --config jest.config.js`.

For more detailed information on the architecture, development workflow, and project conventions, please refer to the `README.md` and `BUILD.md` files.
