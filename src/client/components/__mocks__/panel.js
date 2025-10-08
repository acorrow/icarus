const React = require('react')

function PanelMock ({ children }) {
  return React.createElement('div', null, children)
}

module.exports = PanelMock
