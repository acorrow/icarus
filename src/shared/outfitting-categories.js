// Outfitting category definitions for ICARUS Outfitting Search
// Shared between client and server

const OUTFITTING_CATEGORIES = {
  ships: {
    label: 'Ships',
    icon: 'ship',
    subcategories: {
      small: {
        label: 'Small Ships',
        description: 'Small landing pad ships'
      },
      medium: {
        label: 'Medium Ships',
        description: 'Medium landing pad ships'
      },
      large: {
        label: 'Large Ships',
        description: 'Large landing pad ships'
      }
    }
  },
  hardpoints: {
    label: 'Hardpoints',
    icon: 'wrench',
    subcategories: {
      weapons: {
        label: 'Weapons',
        description: 'Lasers, cannons, missiles, and other weapons'
      },
      utilities: {
        label: 'Utilities',
        description: 'Shield boosters, chaff, heat sinks, scanners'
      }
    }
  },
  core_internal: {
    label: 'Core Internal',
    icon: 'engineering',
    subcategories: {
      powerPlant: {
        label: 'Power Plant',
        description: 'Core power generation'
      },
      thrusters: {
        label: 'Thrusters',
        description: 'Core propulsion'
      },
      frameShiftDrive: {
        label: 'Frame Shift Drive',
        description: 'FSD for supercruise and hyperspace'
      },
      lifeSupport: {
        label: 'Life Support',
        description: 'Emergency oxygen systems'
      },
      powerDistributor: {
        label: 'Power Distributor',
        description: 'Manages power allocation'
      },
      sensors: {
        label: 'Sensors',
        description: 'Scanning and detection systems'
      },
      fuelTank: {
        label: 'Fuel Tank',
        description: 'Fuel capacity expansion'
      }
    }
  },
  optional_internal: {
    label: 'Optional Internal',
    icon: 'cargo',
    subcategories: {
      fighterHangar: {
        label: 'Fighter Hangars',
        description: 'Ship-launched fighter bays'
      },
      fuelScoop: {
        label: 'Fuel Scoops',
        description: 'Refuel from stars'
      },
      shieldGenerator: {
        label: 'Shield Generators',
        description: 'Primary shield systems'
      },
      cargoRack: {
        label: 'Cargo Racks',
        description: 'Cargo capacity expansion'
      },
      collectorLimpet: {
        label: 'Collector Limpets',
        description: 'Automated cargo collection'
      },
      prospectorLimpet: {
        label: 'Prospector Limpets',
        description: 'Asteroid analysis drones'
      },
      detailedSurfaceScanner: {
        label: 'Detailed Surface Scanner',
        description: 'Surface mapping tools'
      },
      planetaryVehicleHangar: {
        label: 'SRV Hangars',
        description: 'Planetary vehicle storage'
      }
    }
  }
}

module.exports = {
  OUTFITTING_CATEGORIES
}
