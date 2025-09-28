export function getInaraNavItems(activeKey) {
  const items = [
    {
      name: 'Search',
      icon: 'search',
      url: '/inara/search',
      key: 'search'
    },
    {
      name: 'Ships',
      icon: 'ship',
      url: '/inara/ships',
      key: 'ships'
    },
    {
      name: 'Missions',
      icon: 'table-rows',
      url: '/inara/missions',
      key: 'missions'
    }
  ]

  return items.map(item => ({
    ...item,
    active: item.key === activeKey
  }))
}
