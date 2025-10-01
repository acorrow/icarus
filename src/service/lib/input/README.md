# ICARUS HID Input Layer

This module exposes an experimental workflow for mapping Windows HID devices (joysticks, button boxes, etc.) to application actions that mirror the keyboard Arrow Up/Down shortcuts used by the native ICARUS panel.

## Prerequisites

* Windows build tools that are compatible with the embedded Node.js v14.15.3 ia32 runtime used by the packaged service.
* Ability to rebuild [`node-hid`](https://github.com/node-hid/node-hid) for the embedded runtime. The build scripts will invoke `npm rebuild node-hid --runtime=node --target=14.15.3 --arch=ia32` automatically on Windows packaging hosts when the module binary is missing.

## Initial setup

```bash
npm install
npm run build:client
```

> **Note:** If you are packaging on Windows ensure the `node-hid` rebuild completes successfully so the generated installers ship with a compatible `HID.node` binary.

## Development workflow

1. Start the service in development mode:
   ```bash
   npm run dev
   ```
2. Open the browser UI at [`http://localhost:3300/native/input-mapping`](http://localhost:3300/native/input-mapping).
3. Connect your joystick or other HID controller. Devices are rediscovered automatically every 10 seconds.
4. Use the **Listen** button beside an action (e.g. *Navigate Up*). Press a button on the controller to capture the binding.
5. Use **Clear** to remove an existing binding if needed.

## Troubleshooting

| Symptom | Suggested Fix |
| --- | --- |
| `HID Input Unavailable` banner with a reason such as `Failed to load node-hid` | Install Windows build tools and rerun the `node-hid` rebuild (`npm rebuild node-hid --runtime=node --target=14.15.3 --arch=ia32`). |
| No devices appear in the list | Confirm the controller is connected and recognised by Windows. Devices are polled every 10 seconds; disconnect/reconnect if necessary. |
| Listen mode never completes | Ensure the button sends a HID report. Some devices only emit data when in specific modes—check the manufacturer documentation. |

Once mapped, button presses will trigger the same navigation logic as the keyboard Arrow Up/Down keys inside the native panel.
