const INPUT_ACTIONS = [
  {
    id: 'nativePanel.navigateUp',
    group: 'nativePanel',
    label: 'Navigate Up',
    description: 'Moves the selection up in the native ICARUS terminal panel.'
  },
  {
    id: 'nativePanel.navigateDown',
    group: 'nativePanel',
    label: 'Navigate Down',
    description: 'Moves the selection down in the native ICARUS terminal panel.'
  }
]

const INPUT_GROUPS = [
  {
    id: 'nativePanel',
    label: 'ICARUS Native Panel'
  }
]

module.exports = {
  INPUT_ACTIONS,
  INPUT_GROUPS
}
