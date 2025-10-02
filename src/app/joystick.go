package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const joystickConfigFileName = "joystick-config.json"

// JoystickConfigDirection represents one of the supported directional mappings.
type JoystickConfigDirection string

const (
	joystickDirectionUp    JoystickConfigDirection = "up"
	joystickDirectionDown  JoystickConfigDirection = "down"
	joystickDirectionLeft  JoystickConfigDirection = "left"
	joystickDirectionRight JoystickConfigDirection = "right"
)

var joystickDirections = []JoystickConfigDirection{
	joystickDirectionUp,
	joystickDirectionDown,
	joystickDirectionLeft,
	joystickDirectionRight,
}

// JoystickConfig holds persisted configuration for HOTAS support.
type JoystickConfig struct {
	Enabled  bool                               `json:"enabled"`
	DeviceID uint32                             `json:"deviceId"`
	Mapping  map[JoystickConfigDirection]uint32 `json:"mapping"`
}

// Valid returns true when the configuration contains a selected device and
// mappings for all supported directions.
func (cfg JoystickConfig) Valid() bool {
	if !cfg.Enabled {
		return false
	}
	if cfg.Mapping == nil {
		return false
	}
	for _, dir := range joystickDirections {
		if cfg.Mapping[dir] == 0 {
			return false
		}
	}
	return true
}

func getJoystickConfigPath(baseDir string) string {
	if baseDir == "" {
		return joystickConfigFileName
	}
	return filepath.Join(baseDir, joystickConfigFileName)
}

// LoadJoystickConfig reads the saved configuration file if present.
func LoadJoystickConfig(baseDir string) (JoystickConfig, error) {
	path := getJoystickConfigPath(baseDir)
	file, err := os.Open(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return JoystickConfig{Enabled: false, Mapping: map[JoystickConfigDirection]uint32{}}, nil
		}
		return JoystickConfig{}, fmt.Errorf("open joystick config: %w", err)
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	var cfg JoystickConfig
	if err := decoder.Decode(&cfg); err != nil {
		return JoystickConfig{}, fmt.Errorf("decode joystick config: %w", err)
	}
	if cfg.Mapping == nil {
		cfg.Mapping = map[JoystickConfigDirection]uint32{}
	}
	return cfg, nil
}

// SaveJoystickConfig persists the configuration to disk.
func SaveJoystickConfig(baseDir string, cfg JoystickConfig) error {
	path := getJoystickConfigPath(baseDir)
	if cfg.Mapping == nil {
		cfg.Mapping = map[JoystickConfigDirection]uint32{}
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal joystick config: %w", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write joystick config: %w", err)
	}
	return nil
}
