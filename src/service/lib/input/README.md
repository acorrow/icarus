# Experimental HID Input Support

This document walks through the steps required to run the experimental Human Interface Device (HID) listener locally and map buttons from a joystick/HOTAS to the native panel navigation actions. Follow these instructions if you see the `HID support disabled – node-hid not available.` warning in the service logs or if the Input Mapping UI reports that HID is unavailable.

> **Packaged builds:** Running `npm run build` (or the individual build steps) now automatically recompiles `node-hid` against the Node 14 runtime used inside the Windows service executable. A fresh installer generated after this change includes the working HID listener without requiring any manual setup.

## Prerequisites

1. **Windows 10 or newer** – the listener currently targets the native Windows build of ICARUS.
2. **Git** – to clone the repository.
3. **Node.js 18.17.1 and npm 9.6.7** – the versions pinned in `package.json`. Install them from [nodejs.org](https://nodejs.org/) or with a version manager such as `nvm-windows`.
4. **Build tools for native Node modules** – `node-hid` contains native code that must be compiled locally.
   - Install the **"Desktop development with C++"** workload from [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), or run `npm install --global --production windows-build-tools` from an elevated PowerShell prompt (requires Python 3).
   - After the tools are installed, restart your terminal so that the `cl` compiler and other dependencies are on the `PATH`.

## One-time setup

```powershell
# Clone the repository
git clone https://github.com/acorrow/icarus.git
cd icarus

# Install dependencies (this compiles node-hid on Windows)
npm install

# Copy the environment file and point LOG_DIR at your Elite Dangerous save folder
Copy-Item .env-example .env
notepad .env   # change LOG_DIR if the default is wrong
```

> **Tip:** The Elite Dangerous journals normally live in `C:\Users\<you>\Saved Games\Frontier Developments\Elite Dangerous`. Leave `LOG_DIR` blank to accept that default.

If you previously installed dependencies before adding the build tools and now see the HID warning while developing locally, rebuild the module:

```powershell
npm rebuild node-hid
```

## Running the development stack

```powershell
# Start the Node service in development mode (port 3300)
npm run dev
```

The command above starts the service, watches for journal updates, and automatically launches a Next.js dev server on port 3000. The service proxies HTTP requests, so you can load the UI at [http://localhost:3300](http://localhost:3300).

To open the mapping interface directly, visit:

```
http://localhost:3300/native/input-mapping
```

Alternatively, use the **Input Mapping** tile on the native launcher page while the service is running.

## Mapping a joystick button

1. Connect your HOTAS/joystick before starting `npm run dev` so Windows exposes the HID device.
2. Open the Input Mapping page and confirm that your device appears in the **Connected Devices** list.
3. Select the **Navigate Up** or **Navigate Down** action, press **Listen for input**, then press the desired button on your controller.
4. The binding is saved immediately. Test by pressing the button again—focus inside the native panel should move just like pressing the arrow keys.
5. Use the **Clear binding** button if you want to remove the mapping.

## Troubleshooting

- **"HID support disabled – node-hid not available."** – The `node-hid` module failed to load. Re-run `npm install` after installing the Visual Studio build tools, then `npm rebuild node-hid`.
- **`npm install` fails while building node-hid** – Ensure you are running the terminal as Administrator and that the Build Tools installer completed (including the Windows 10 SDK and MSVC toolchain).
- **Device not listed** – Unplug/replug the controller and watch the service logs. Each detected device prints a register/unregister message. If it still does not appear, check that Windows recognises the device in `joy.cpl`.
- **Need mock game data** – If you do not have Elite Dangerous logs, set `LOG_DIR` to `resources/mock-game-data` in your `.env` file so the UI can render with the bundled fixtures.

With the steps above, the experimental HID listener should run locally and accept button mappings for the native panel navigation actions.
