//go:build windows

package main

import (
	"errors"
	"fmt"
	"syscall"
	"time"
	"unsafe"
)

type joystickDevice struct {
	ID         uint32 `json:"id"`
	Name       string `json:"name"`
	NumButtons uint32 `json:"numButtons"`
}

type joystickPollResult struct {
	buttons uint32
}

const (
	maxPNameLen              = 32
	maxJoystickOEMVXDNameLen = 260

	joyErrNoError      = 0
	joyReturnButtons   = 0x80
	joyReturnPov       = 0x40
	joyReturnAll       = 0xFF
	joystickPollPeriod = 30 * time.Millisecond
)

type joyinfoex struct {
	dwSize         uint32
	dwFlags        uint32
	dwXpos         uint32
	dwYpos         uint32
	dwZpos         uint32
	dwRpos         uint32
	dwUpos         uint32
	dwVpos         uint32
	dwButtons      uint32
	dwButtonNumber uint32
	dwPOV          uint32
	dwReserved1    uint32
	dwReserved2    uint32
}

type joycaps struct {
	wMid        uint16
	wPid        uint16
	szPname     [maxPNameLen]uint16
	wXmin       uint32
	wXmax       uint32
	wYmin       uint32
	wYmax       uint32
	wZmin       uint32
	wZmax       uint32
	wNumButtons uint32
	wPeriodMin  uint32
	wPeriodMax  uint32
	wRmin       uint32
	wRmax       uint32
	wUmin       uint32
	wUmax       uint32
	wVmin       uint32
	wVmax       uint32
	wCaps       uint32
	wMaxAxes    uint32
	wNumAxes    uint32
	wMaxButtons uint32
	szRegKey    [maxPNameLen]uint16
	szOEMVxD    [maxJoystickOEMVXDNameLen]uint16
}

var (
	winmm              = syscall.NewLazyDLL("winmm.dll")
	procJoyGetNumDevs  = winmm.NewProc("joyGetNumDevs")
	procJoyGetDevCapsW = winmm.NewProc("joyGetDevCapsW")
	procJoyGetPosEx    = winmm.NewProc("joyGetPosEx")
)

func getJoystickDevices() ([]joystickDevice, error) {
	if err := winmm.Load(); err != nil {
		return nil, fmt.Errorf("load winmm: %w", err)
	}

	r1, _, err := procJoyGetNumDevs.Call()
	if r1 == 0 {
		if err != syscall.Errno(0) {
			return nil, fmt.Errorf("joyGetNumDevs: %w", err)
		}
		return nil, nil
	}
	num := uint32(r1)
	devices := make([]joystickDevice, 0, num)
	for id := uint32(0); id < num; id++ {
		var caps joycaps
		capsSize := unsafe.Sizeof(caps)
		ret, _, callErr := procJoyGetDevCapsW.Call(uintptr(id), uintptr(unsafe.Pointer(&caps)), uintptr(capsSize))
		if ret != joyErrNoError {
			if callErr != syscall.Errno(0) {
				continue
			}
			continue
		}
		name := syscall.UTF16ToString(caps.szPname[:])
		if name == "" {
			name = fmt.Sprintf("Joystick %d", id+1)
		}
		devices = append(devices, joystickDevice{ID: id, Name: name, NumButtons: caps.wNumButtons})
	}
	return devices, nil
}

func pollJoystickButtons(id uint32) (joystickPollResult, error) {
	var info joyinfoex
	info.dwSize = uint32(unsafe.Sizeof(info))
	info.dwFlags = joyReturnAll
	ret, _, callErr := procJoyGetPosEx.Call(uintptr(id), uintptr(unsafe.Pointer(&info)))
	if ret != joyErrNoError {
		if callErr != syscall.Errno(0) {
			return joystickPollResult{}, fmt.Errorf("joyGetPosEx: %w", callErr)
		}
		return joystickPollResult{}, errors.New("unable to read joystick state")
	}
	return joystickPollResult{buttons: info.dwButtons}, nil
}

func captureNextButton(id uint32, cancel <-chan struct{}) (uint32, error) {
	initial, err := pollJoystickButtons(id)
	if err != nil {
		return 0, err
	}
	current := initial.buttons
	for {
		select {
		case <-cancel:
			return 0, errors.New("capture cancelled")
		default:
		}

		res, err := pollJoystickButtons(id)
		if err != nil {
			time.Sleep(joystickPollPeriod)
			continue
		}
		if res.buttons != current {
			diff := res.buttons &^ current
			if diff == 0 {
				diff = res.buttons
			}
			button := lowestButtonIndex(diff)
			if button > 0 {
				return button, nil
			}
		}
		current = res.buttons
		time.Sleep(joystickPollPeriod)
	}
}

func lowestButtonIndex(mask uint32) uint32 {
	if mask == 0 {
		return 0
	}
	idx := uint32(1)
	for (mask & 1) == 0 {
		mask >>= 1
		idx++
	}
	return idx
}
