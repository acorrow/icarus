//go:build windows

package main

import (
	"errors"
	"fmt"
	"sync"
	"time"

	w32 "github.com/gonutz/w32/v2"
	"github.com/nvsoft/win"
)

type joystickRuntime struct {
	hwnd        win.HWND
	config      JoystickConfig
	stopChan    chan struct{}
	stoppedOnce sync.Once
}

func newJoystickRuntime(hwnd win.HWND, cfg JoystickConfig) (*joystickRuntime, error) {
	if !cfg.Valid() {
		return nil, errors.New("joystick configuration is not valid")
	}
	return &joystickRuntime{
		hwnd:     hwnd,
		config:   cfg,
		stopChan: make(chan struct{}),
	}, nil
}

func (rt *joystickRuntime) start() {
	go rt.loop()
}

func (rt *joystickRuntime) stop() {
	rt.stoppedOnce.Do(func() {
		close(rt.stopChan)
	})
}

func (rt *joystickRuntime) loop() {
	mapping := rt.config.Mapping
	prevState := make(map[JoystickConfigDirection]bool)
	ticker := time.NewTicker(joystickPollPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-rt.stopChan:
			rt.releaseAll(prevState)
			return
		case <-ticker.C:
			if win.GetForegroundWindow() != rt.hwnd {
				rt.releaseAll(prevState)
				continue
			}
			res, err := pollJoystickButtons(rt.config.DeviceID)
			if err != nil {
				continue
			}
			for direction, button := range mapping {
				if button == 0 {
					continue
				}
				pressed := (res.buttons & (1 << (button - 1))) != 0
				if prevState[direction] == pressed {
					continue
				}
				rt.sendKeyEvent(direction, pressed)
				prevState[direction] = pressed
			}
		}
	}
}

func (rt *joystickRuntime) releaseAll(prevState map[JoystickConfigDirection]bool) {
	for direction, pressed := range prevState {
		if pressed {
			rt.sendKeyEvent(direction, false)
			prevState[direction] = false
		}
	}
}

func (rt *joystickRuntime) sendKeyEvent(direction JoystickConfigDirection, pressed bool) {
	var vk uint16
	switch direction {
	case joystickDirectionUp:
		vk = win.VK_UP
	case joystickDirectionDown:
		vk = win.VK_DOWN
	case joystickDirectionLeft:
		vk = win.VK_LEFT
	case joystickDirectionRight:
		vk = win.VK_RIGHT
	default:
		return
	}
	flags := uint32(0)
	if !pressed {
		flags = w32.KEYEVENTF_KEYUP
	}
	input := w32.KeyboardInput(w32.KEYBDINPUT{
		Vk:    w32.WORD(vk),
		Scan:  0,
		Flags: flags,
	})
	w32.SendInput(input)
}

func ensureJoystickRuntime(hwnd win.HWND, cfg JoystickConfig) (*joystickRuntime, error) {
	runtime, err := newJoystickRuntime(hwnd, cfg)
	if err != nil {
		return nil, fmt.Errorf("create joystick runtime: %w", err)
	}
	runtime.start()
	return runtime, nil
}
