//go:build windows

package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/webview/webview"
)

type joystickConfigPayload struct {
	Enabled  bool                               `json:"enabled"`
	DeviceID uint32                             `json:"deviceId"`
	Mapping  map[JoystickConfigDirection]uint32 `json:"mapping"`
}

type joystickConfigurator struct {
	baseDir string
	config  JoystickConfig

	captureMu     sync.Mutex
	captureCancel context.CancelFunc
}

func (jc *joystickConfigurator) setDevice(id uint32) {
	jc.config.DeviceID = id
}

func newJoystickConfigurator(baseDir string) (*joystickConfigurator, error) {
	cfg, err := LoadJoystickConfig(baseDir)
	if err != nil {
		return nil, err
	}
	if cfg.Mapping == nil {
		cfg.Mapping = map[JoystickConfigDirection]uint32{}
	}
	return &joystickConfigurator{baseDir: baseDir, config: cfg}, nil
}

func (jc *joystickConfigurator) listDevices() ([]joystickDevice, error) {
	return getJoystickDevices()
}

func (jc *joystickConfigurator) loadConfig() joystickConfigPayload {
	return joystickConfigPayload{
		Enabled:  jc.config.Enabled,
		DeviceID: jc.config.DeviceID,
		Mapping:  jc.config.Mapping,
	}
}

func (jc *joystickConfigurator) updateConfig(payload joystickConfigPayload) error {
	if payload.Mapping == nil {
		payload.Mapping = map[JoystickConfigDirection]uint32{}
	}
	jc.config.Enabled = payload.Enabled
	jc.config.DeviceID = payload.DeviceID
	jc.config.Mapping = payload.Mapping
	return SaveJoystickConfig(jc.baseDir, jc.config)
}

func (jc *joystickConfigurator) capture(deviceID uint32, direction JoystickConfigDirection) (uint32, error) {
	jc.captureMu.Lock()
	if jc.captureCancel != nil {
		jc.captureCancel()
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	jc.captureCancel = cancel
	jc.captureMu.Unlock()

	defer func() {
		jc.captureMu.Lock()
		if jc.captureCancel != nil {
			jc.captureCancel()
			jc.captureCancel = nil
		}
		jc.captureMu.Unlock()
	}()

	button, err := captureNextButton(deviceID, ctx.Done())
	if err != nil {
		return 0, err
	}
	if jc.config.Mapping == nil {
		jc.config.Mapping = map[JoystickConfigDirection]uint32{}
	}
	jc.config.Mapping[direction] = button
	jc.config.DeviceID = deviceID
	return button, nil
}

func runJoystickConfigurationWindow(baseDir string) error {
	configurator, err := newJoystickConfigurator(baseDir)
	if err != nil {
		return err
	}

	w := webview.New(DEBUGGER)
	if w == nil {
		return fmt.Errorf("failed to create configuration window")
	}
	defer w.Destroy()

	w.SetTitle("HOTAS Navigation Mapping")
	w.SetSize(520, 560, webview.HintNone)

	bindJoystickConfigurator(w, configurator)

	w.Navigate(configurationDataURL())
	w.Run()
	return nil
}

func bindJoystickConfigurator(w webview.WebView, configurator *joystickConfigurator) {
	w.Bind("icarusJoystick_listDevices", func() ([]joystickDevice, error) {
		return configurator.listDevices()
	})
	w.Bind("icarusJoystick_loadConfig", func() joystickConfigPayload {
		return configurator.loadConfig()
	})
	w.Bind("icarusJoystick_saveConfig", func(payload map[string]interface{}) (string, error) {
		jsonBytes, err := json.Marshal(payload)
		if err != nil {
			return "", err
		}
		var parsed joystickConfigPayload
		if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
			return "", err
		}
		if err := configurator.updateConfig(parsed); err != nil {
			return "", err
		}
		return "saved", nil
	})
	w.Bind("icarusJoystick_setDevice", func(device float64) {
		if device < 0 {
			return
		}
		configurator.setDevice(uint32(device))
	})
	w.Bind("icarusJoystick_capture", func(direction string, device float64) (uint32, error) {
		dir := JoystickConfigDirection(direction)
		valid := false
		for _, d := range joystickDirections {
			if d == dir {
				valid = true
				break
			}
		}
		if !valid {
			return 0, fmt.Errorf("unknown direction %s", direction)
		}
		if device < 0 {
			return 0, fmt.Errorf("invalid device id")
		}
		return configurator.capture(uint32(device), dir)
	})
}

func configurationDataURL() string {
	encoded := base64.StdEncoding.EncodeToString([]byte(joystickConfigHTML))
	return "data:text/html;base64," + encoded
}

const joystickConfigHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>HOTAS Navigation Mapping</title>
<style>
body {
    margin: 0;
    font-family: "Segoe UI", Arial, sans-serif;
    background: #12101f;
    color: #f5f1ff;
}
header {
    padding: 20px 24px 0;
}
main {
    padding: 0 24px 24px;
}
section {
    margin-bottom: 24px;
    background: rgba(20, 18, 36, 0.9);
    border: 1px solid rgba(140, 92, 255, 0.35);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 12px 24px rgba(13, 11, 26, 0.55);
}
section h2 {
    margin-top: 0;
    font-size: 18px;
}
label {
    display: block;
    margin-bottom: 8px;
}
select, button {
    font-size: 14px;
    padding: 8px 12px;
    border-radius: 8px;
    border: none;
    background: rgba(93, 46, 255, 0.6);
    color: #f5f1ff;
    cursor: pointer;
}
select {
    width: 100%;
    background: rgba(18, 16, 32, 0.7);
    border: 1px solid rgba(140, 92, 255, 0.35);
}
button.capture {
    width: 100%;
    margin-top: 8px;
}
button.primary {
    background: #5d2eff;
}
.status {
    margin-top: 12px;
    font-size: 13px;
    color: rgba(245, 241, 255, 0.75);
}
.direction-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}
.direction-card {
    border: 1px solid rgba(140, 92, 255, 0.35);
    border-radius: 12px;
    padding: 12px;
    background: rgba(18, 16, 32, 0.85);
}
.direction-card h3 {
    margin: 0 0 8px;
    font-size: 16px;
}
.direction-card p {
    margin: 0;
    font-size: 13px;
    color: rgba(245, 241, 255, 0.6);
}
.toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}
.toggle input[type="checkbox"] {
    width: 18px;
    height: 18px;
}
</style>
</head>
<body>
<header>
    <h1>HOTAS Navigation Mapping</h1>
    <p>Bind joystick buttons to arrow key navigation for the first native terminal window.</p>
</header>
<main>
    <section>
        <div class="toggle">
            <input type="checkbox" id="enable-toggle" />
            <label for="enable-toggle">Enable joystick navigation</label>
        </div>
        <label for="device-select">Detected HOTAS / Joystick</label>
        <select id="device-select"></select>
        <div class="status" id="device-status"></div>
    </section>
    <section>
        <h2>Directional Mapping</h2>
        <div class="direction-grid">
            <div class="direction-card" data-direction="up">
                <h3>Up</h3>
                <p>Button: <span class="button-label">Not set</span></p>
                <button class="capture" data-direction="up">Capture</button>
            </div>
            <div class="direction-card" data-direction="down">
                <h3>Down</h3>
                <p>Button: <span class="button-label">Not set</span></p>
                <button class="capture" data-direction="down">Capture</button>
            </div>
            <div class="direction-card" data-direction="left">
                <h3>Left</h3>
                <p>Button: <span class="button-label">Not set</span></p>
                <button class="capture" data-direction="left">Capture</button>
            </div>
            <div class="direction-card" data-direction="right">
                <h3>Right</h3>
                <p>Button: <span class="button-label">Not set</span></p>
                <button class="capture" data-direction="right">Capture</button>
            </div>
        </div>
    </section>
    <section>
        <button class="primary" id="save-btn">Save configuration</button>
        <div class="status" id="save-status"></div>
    </section>
</main>
<script>
const state = {
    enabled: false,
    deviceId: 0,
    mapping: {
        up: 0,
        down: 0,
        left: 0,
        right: 0,
    },
    devices: []
};

function renderMapping() {
    document.querySelectorAll('.direction-card').forEach(card => {
        const direction = card.dataset.direction;
        const value = state.mapping[direction] || 0;
        const label = value ? 'Button ' + value : 'Not set';
        card.querySelector('.button-label').textContent = label;
        card.querySelector('.capture').disabled = !state.enabled;
    });
}

function renderDeviceList() {
    const select = document.getElementById('device-select');
    select.innerHTML = '';
    state.devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = device.name + ' (' + device.numButtons + ' buttons)';
        select.appendChild(option);
    });
    select.value = state.deviceId;
    select.disabled = !state.enabled || state.devices.length === 0;
    const status = document.getElementById('device-status');
    if (state.devices.length === 0) {
        status.textContent = 'No HOTAS or joystick devices detected.';
    } else {
        status.textContent = '';
    }
}

async function loadDevices() {
    try {
        state.devices = await window.icarusJoystick_listDevices();
    } catch (err) {
        console.error(err);
        state.devices = [];
    }
    renderDeviceList();
}

async function loadConfig() {
    try {
        const cfg = await window.icarusJoystick_loadConfig();
        state.enabled = !!cfg.enabled;
        state.deviceId = cfg.deviceId || 0;
        state.mapping = Object.assign({}, state.mapping, cfg.mapping || {});
        if (state.deviceId !== undefined) {
            window.icarusJoystick_setDevice(state.deviceId);
        }
    } catch (err) {
        console.error(err);
    }
    document.getElementById('enable-toggle').checked = state.enabled;
    renderDeviceList();
    renderMapping();
}

document.getElementById('enable-toggle').addEventListener('change', evt => {
    state.enabled = evt.target.checked;
    renderDeviceList();
    renderMapping();
});

document.getElementById('device-select').addEventListener('change', evt => {
    state.deviceId = parseInt(evt.target.value, 10);
    window.icarusJoystick_setDevice(state.deviceId);
});

document.querySelectorAll('.capture').forEach(btn => {
    btn.addEventListener('click', async evt => {
        const direction = evt.target.dataset.direction;
        document.getElementById('save-status').textContent = 'Waiting for ' + direction + ' input...';
        try {
            const button = await window.icarusJoystick_capture(direction, state.deviceId);
            state.mapping[direction] = button;
            renderMapping();
            document.getElementById('save-status').textContent = 'Captured button ' + button + ' for ' + direction + '.';
        } catch (err) {
            document.getElementById('save-status').textContent = err.message || 'Capture cancelled.';
        }
    });
});

document.getElementById('save-btn').addEventListener('click', async () => {
    const payload = {
        enabled: state.enabled,
        deviceId: state.deviceId,
        mapping: state.mapping,
    };
    try {
        await window.icarusJoystick_saveConfig(payload);
        document.getElementById('save-status').textContent = 'Configuration saved.';
    } catch (err) {
        document.getElementById('save-status').textContent = err.message || 'Failed to save configuration.';
    }
});

loadDevices().then(loadConfig);
</script>
</body>
</html>
`
