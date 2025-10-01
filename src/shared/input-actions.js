const INPUT_ACTIONS = {
  'nativePanel.navigateUp': {
    id: 'nativePanel.navigateUp',
    label: 'Navigate Up',
    description: 'Move the selection up in the native ICARUS panel.',
    group: 'nativePanel'
  },
  'nativePanel.navigateDown': {
    id: 'nativePanel.navigateDown',
    label: 'Navigate Down',
    description: 'Move the selection down in the native ICARUS panel.',
    group: 'nativePanel'
  }
}

const INPUT_GROUPS = [
  {
    id: 'nativePanel',
    label: 'Native Panel',
    description: 'Bindings used by the native ICARUS launcher panel.',
    actions: [
      'nativePanel.navigateUp',
      'nativePanel.navigateDown'
    ]
  }
]

module.exports = {
  INPUT_ACTIONS,
  INPUT_GROUPS
}
