// Outfitting category definitions for ICARUS Outfitting Search
// Shared between client and server

const OUTFITTING_CATEGORIES = {
  ships: {
    label: 'Ships',
    icon: 'ship',
    subcategories: {
      all: {
        label: 'All Ships',
        description: 'All available ships'
      }
    }
  },
  hardpoints: {
    label: 'Hardpoints',
    icon: 'wrench',
    subcategories: {
      weapons: {
        label: 'Weapons',
        description: 'Beam lasers, multi-cannons, missiles, and other weapons'
      },
      utilities: {
        label: 'Utility Mounts',
        description: 'Scanners, shield boosters, chaff, heat sinks, ECM'
      }
    }
  },
  core_internal: {
    label: 'Core Internal Modules',
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
        description: 'Manages power allocation to SYS/ENG/WEP'
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
    label: 'Optional Internal Modules',
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
        description: 'Standard shield systems'
      },
      biWeaveShield: {
        label: 'Bi-Weave Shields',
        description: 'Fast-recharge shield generators'
      },
      cargoRack: {
        label: 'Cargo Racks',
        description: 'Cargo capacity expansion'
      },
      collectorLimpet: {
        label: 'Collector Limpet Controllers',
        description: 'Automated cargo collection drones'
      },
      prospectorLimpet: {
        label: 'Prospector Limpet Controllers',
        description: 'Asteroid analysis drones'
      },
      passengerCabin: {
        label: 'Passenger Cabins',
        description: 'Economy, business, first class, and luxury cabins'
      },
      refinery: {
        label: 'Refineries',
        description: 'Ore processing modules'
      },
      srvHangar: {
        label: 'Planetary Vehicle Hangars',
        description: 'SRV surface vehicle storage'
      },
      afmu: {
        label: 'Auto Field-Maintenance Units',
        description: 'Module repair systems'
      },
      other: {
        label: 'Other Modules',
        description: 'Hull reinforcement, module reinforcement, and specialty modules'
      }
    }
  }
}

module.exports = {
  OUTFITTING_CATEGORIES
}
