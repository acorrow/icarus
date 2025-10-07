function ShipPanelNavItems (activePanel) {
  const navigationItems = [
    {
      name: 'Status',
      icon: 'ship',
      url: '/ship/status'
    },
    {
      name: 'Modules',
      icon: 'wrench',
      url: '/ship/modules'
    },
    {
      name: 'Cargo',
      icon: 'cargo',
      url: '/ship/cargo'
    },
    {
      name: 'Inventory',
      icon: 'inventory',
      url: '/ship/inventory'
    }
  ]
  navigationItems.forEach(item => {
    if (item.name.toLowerCase() === activePanel.toLowerCase()) item.active = true
  })
  return navigationItems
}

function NavPanelNavItems (activePanel, query) {
  const navigationItems = [
    {
      name: 'Search',
      icon: 'search',
      type: 'SEARCH'
    },
    {
      name: 'Map',
      icon: 'system-bodies',
      url: {
        pathname: '/nav/map',
        query
      }
    },
    {
      name: 'List',
      icon: 'table-inspector',
      url: {
        pathname: '/nav/list',
        query
      }
    },
    {
      name: 'Route',
      icon: 'route',
      url: {
        pathname: '/nav/route',
        query
      }
    }
  ]
  navigationItems.forEach(item => {
    if (item.name.toLowerCase() === activePanel.toLowerCase()) item.active = true
  })
  return navigationItems
}

function InaraPanelNavItems (activePanel) {
  const navigationItems = [
    {
      name: 'Status',
      icon: 'route',
      url: '/inara/status'
    },
    {
      name: 'Search',
      icon: 'search',
      url: '/inara/search'
    },
    {
      name: 'Outfitting',
      icon: 'wrench',
      url: '/inara/outfitting'
    }
  ]

  navigationItems.forEach(item => {
    if (item.name.toLowerCase() === activePanel.toLowerCase()) item.active = true
  })

  return navigationItems
}

function InaraWorkspaceNavItems (activePanel) {
  const navigationItems = [
    {
      name: 'Trade Routes',
      icon: 'route',
      url: '/inara/trade-routes'
    },
    {
      name: 'Cargo',
      icon: 'cargo',
      url: '/inara/cargo'
    },
    {
      name: 'Mining Missions',
      icon: 'asteroid-base',
      url: '/inara/mining-missions'
    },
    {
      name: 'Mining Locations',
      icon: 'planet-ringed',
      url: '/inara/mining-locations'
    }
  ]

  navigationItems.forEach(item => {
    if (item.name.toLowerCase() === activePanel.toLowerCase()) item.active = true
  })

  return navigationItems
}

function EngineeringPanelNavItems (activePanel) {
  const navigationItems = [
    {
      name: 'Blueprints',
      icon: 'engineering',
      url: '/eng/blueprints'
    },
    {
      name: 'Engineers',
      icon: 'engineer',
      url: '/eng/engineers'
    },
    {
      name: 'Raw Materials',
      icon: 'materials-raw',
      url: '/eng/raw-materials'
    },
    {
      name: 'Manufactured Materials',
      icon: 'materials-manufactured',
      url: '/eng/manufactured-materials'
    },
    {
      name: 'Encoded Materials',
      icon: 'materials-encoded',
      url: '/eng/encoded-materials'
    },
    {
      name: 'Xeno Materials',
      icon: 'materials-xeno',
      url: '/eng/xeno-materials'
    }
  ]
  navigationItems.forEach(item => {
    if (item.name.toLowerCase() === activePanel.toLowerCase()) item.active = true
  })
  return navigationItems
}

function SettingsNavItems (activePanel) {
  const navigationItems = [
    {
      name: 'Theme',
      icon: 'color-picker'
    },
    {
      name: 'Sounds',
      icon: 'sound'
    },
    {
      name: 'Feature Flags',
      icon: 'settings'
    }
  ]
  navigationItems.forEach(item => {
    if (item.name.toLowerCase() === activePanel.toLowerCase()) item.active = true
  })
  return navigationItems
}

module.exports = {
  ShipPanelNavItems,
  NavPanelNavItems,
  InaraPanelNavItems,
  InaraWorkspaceNavItems,
  EngineeringPanelNavItems,
  SettingsNavItems
}
