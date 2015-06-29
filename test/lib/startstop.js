/**
 * start-stop tcp proxy for mocha tests
 *
 * @license MIT
 * @copyright 2015 commenthol
 */

'use strict'

var path = require('path')
var child = require('child_process')
var debug = require('debug')('startStop')

function startStop (bind, remote) {
  var self = {}

  self.create = function (cb) {
    self.close()
    if (!self.started) {
      self._prx = child.fork(path.resolve(__dirname, '../tcpproxy.js'), [ bind, remote ])
      self.started = true
      setTimeout(function () {
        debug('proxy create', Date.now())
        cb && cb()
      }, 250)
    } else {
      cb(new Error('already connectoed'))
    }
  }

  self.close = function () {
    if (self.started) {
      self._prx.kill()
      self._prx = null
      self.started = false
      debug('proxy close', Date.now())
    }
  }

  return self
};

module.exports = startStop

if (require.main === module) {
  var st = startStop(':3002', ':4000')
  st.create()
  setTimeout(function () {
    st.close()
  }, 3000)
}
