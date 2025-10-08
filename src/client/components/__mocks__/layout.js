const React = require('react')

function LayoutMock ({ children }) {
  return React.createElement(React.Fragment, null, children)
}

module.exports = LayoutMock
