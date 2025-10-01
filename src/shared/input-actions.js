const INPUT_GROUPS = {
  nativePanel: {
    id: 'nativePanel',
    label: 'Native Panel',
    description: 'Control navigation within the native ICARUS panel.'
  }
}

const INPUT_ACTIONS = {
  'nativePanel.navigateUp': {
    id: 'nativePanel.navigateUp',
    group: 'nativePanel',
    label: 'Navigate Up',
    description: 'Moves the selection up in the native panel (Arrow Up).'
  },
  'nativePanel.navigateDown': {
    id: 'nativePanel.navigateDown',
    group: 'nativePanel',
    label: 'Navigate Down',
    description: 'Moves the selection down in the native panel (Arrow Down).'
  }
}

module.exports = {
  INPUT_ACTIONS,
  INPUT_GROUPS
}
