# ICARUS HID Input Mapping

The HID listener ships with the ICARUS service and enables game controllers (for example, joysticks) to trigger in-app navigation events. The workflow is experimental and currently requires the Windows build of ICARUS.

## Prerequisites

Before packaging or running the service ensure the following tools are installed on Windows:

- Latest Visual Studio Build Tools (including Desktop development with C++ workload).
- Python 3 (required by `node-gyp`).
- A working `npm` environment.

The build scripts automatically rebuild `node-hid` for the embedded Node 14.15.3 ia32 runtime that ships with the native service. If you are installing dependencies manually run:

```
npm install
npm rebuild node-hid --runtime=node --target=14.15.3 --arch=ia32
```

## Development setup

1. Install dependencies with `npm install`.
2. Start the development service using `npm run dev`.
3. Open the client at `http://localhost:3300/native/input-mapping`.
4. Connect your joystick or HID controller and press **Listen** beside the desired action.
5. Press the button on your controller to capture a binding. Use **Clear** to remove an existing binding.

Captured bindings are stored in `%LOCALAPPDATA%\ICARUS Terminal\InputMappings.json` (or the equivalent preferences directory on other platforms) so they persist across restarts.

## Troubleshooting

- **HID unavailable** – If the page shows HID input unavailable, confirm that the service could load the `node-hid` native module. The reported reason will include the underlying error (for example, missing build tools or an out-of-date binary). Re-running `npm rebuild node-hid --runtime=node --target=14.15.3 --arch=ia32` usually resolves missing binary errors.
- **No devices detected** – The listener refreshes the device list every 10 seconds. Connect the controller and wait for the devices list to update. If nothing appears, verify the controller works in Windows and that it exposes a standard HID interface.
- **Button press not recognised** – Use **Listen** to re-capture the binding. The workflow matches exact HID payloads; certain controllers may require different modes (for example, XInput vs DirectInput) to expose consistent HID data.

When everything is working the page will show connected HID devices, each action’s current binding, and the status indicator will confirm the service is actively listening for input events.
