#!/usr/bin/env node

/**
 * a tcp proxy
 *
 * @license MIT
 * @copyright 2015 commenthol
 */

'use strict'

var net = require('net')
var http = require('http')
var debug = require('debug')('tcpproxy')

var PORT = 3000

function logEmits (emitter, name) {
  if (0) { // eslint-disable-line
    var _emit = emitter.emit
    emitter.emit = function () {
      console.log(name, arguments[0])
      _emit.apply(emitter, arguments)
    }
  }
}

// server states
var state = {}
;['CLOSE', 'LISTEN', 'REFUSE', 'RESET']
.forEach(function (s) {
  state[s] = s
})

function SocketHandler (interval) {
  this.sockets = []
  var _this = this
  setInterval(function () {
    _this._cleanup()
  }, interval || 100)
}
SocketHandler.prototype = {
  _cleanup: function () {
    this.sockets = this.sockets.filter(function (socket) {
      return socket.writable
    })
    debug('SocketHandler._cleanup %d', this.sockets.length)
  },
  add: function (socket) {
    this.sockets.push(socket)
    debug('SocketHandler.add %d', this.sockets.length)
  },
  destroy: function () {
    this.sockets.forEach(function (socket) {
      socket.destroy()
    })
    this.sockets = []
  }
}

/**
 * tcp proxy
 * @param {String} origin - address and port, e.g. ':8080' or '0.0.0.0:8080'
 * @param {String} remote - address and port, e.g. ':8081' or '192.168.178.1:1001'
 * @param {String} control - address and port, e.g. ':3000' or '0.0.0.0:3000'
 */
function TcpProxy (origin, remote, control) {
  this.options = {
    origin: TcpProxy.addressPort(origin),
    client: TcpProxy.addressPort(remote),
    control: TcpProxy.addressPort(control)
  }
  this.state = state.CLOSE
  this.sockets = new SocketHandler()
  this.createServer()
  if (control) {
    this.controlServer()
  }
}
module.exports = TcpProxy

TcpProxy.prototype = {
  /**
  * create the tcp proxy
  * @private
  */
  createServer: function () {
    var _this = this

    this.server = net.createServer(function (origin) {
      logEmits(origin, 'origin')

      if (_this.state === state.RESET) {
        origin.destroy()
        return
      } else if (_this.state === state.REFUSE) {
        origin.destroy()
        return
      }

      var client = new net.Socket()
      logEmits(client, 'client')

      _this.sockets.add(origin)
      _this.sockets.add(client)

      function closeHandler () {
        origin.end()
        client.end()
      }

      client.connect(_this.options.client.port, _this.options.client.address, function () {
        origin.pipe(client).pipe(origin)
      })

      origin.once('close', closeHandler)
      client.once('close', closeHandler)
    })

    logEmits(this.server, 'server')
    this.server.on('error', function (err) {
      debug('server error %s', err.message)
    })
  },

  /**
  * create the http control server.
  * @private
  */
  controlServer: function () {
    var _this = this

    function handle (req, res) {
      var cmd = /^\/([a-z]+)/.exec(req.url)
      _this.control(cmd[1], function (err, msg) {
        err = null
        res.end(JSON.stringify(msg) + '\n')
      })
    }

    var cmdServer = http.createServer(handle)
    cmdServer.listen(this.options.control.port, this.options.control.address)
  },

  /**
  * commands to control the proxy
  * @param {String} cmd - (listen|close|refuse|reset)
  * @return {Object}
  */
  control: function (cmd, cb) {
    var _this = this

    function _cb (err, msg) {
      err = null
      msg = Object.assign({state: _this.state}, msg)
      debug('control %j', msg)
      cb && cb(null, msg)
    }

    switch (cmd) {
      case 'listen':
        this.listen(_cb)
        break
      case 'close':
        this.close(_cb)
        break
      case 'refuse':
        if (this.state === state.LISTEN) {
          this.state = state.REFUSE
        }
        _cb()
        break
      case 'reset':
        if (this.state === state.LISTEN) {
          this.state = state.RESET
        }
        _cb()
        break
      default:
        _cb(null, {error: 'invalid command'})
        break
    }
  },

  /**
   * open proxy
   * @param {Function} callback - callback function
   */
  listen: function (callback) {
    var _this = this
    if (!this.server) this.createServer()
    this.server.listen(
      this.options.origin.port,
      this.options.origin.address,
      function (err) {
        if (!err) {
          _this.state = state.LISTEN
        } else {
          debug('error listen %s %s', err.message, err.code)
        }
        callback && callback(err)
      }
    )
  },
  /**
   * close proxy
   * @param {Function} callback - callback function
   */
  close: function (callback) {
    var _this = this
    if (!this.server) {
      callback && callback()
      return
    }
    this.sockets.destroy() // need to detroy all sockets first
    this.server.close(function (err) {
      if (!err) {
        _this.state = state.CLOSE
      } else {
        debug('error close %s %s', err.message, err.code)
      }
      _this.server = null
      callback && callback(err)
    })
  }
}

/**
 * split string into address and port
 * @param {String} str - address and port, e.g. ':3000' or '0.0.0.0:3000'
 * @return {Object} - `{ address: {String}, port: {Number} }`
 */
TcpProxy.addressPort = function addressPort (str, port) {
  str += ''
  var res = {
    address: '127.0.0.1',
    port: port || PORT
  }
  var tmp = str.match(/^(.*):(\d+)$/)
  if (tmp && tmp.length >= 3) {
    res = {
      address: tmp[1] || '127.0.0.1',
      port: parseInt(tmp[2], 10)
    }
  }
  return res
}

if (require.main === module) {
  /**
   * start from console with `node tcpproxy.js`
   *
   * Default connection is between binding port :27016 to :27017 on
   * localhost
   *
   * __Example__
   *
   * Connect between port 3001 and 4000
   *
   * ```bash
   * node tcpproxy.js :3001 :4000
   * ```
   */
  ;(function () {
    var argv = process.argv.slice(2)
    if (argv.length === 0) {
      argv = [':27016', ':27017']
    }
    if (argv.length >= 2) {
      var proxy = new TcpProxy(argv[0], argv[1], argv[2])
      proxy.listen(function (err) {
        debug('proxy listen')
        if (err) {
          console.error(err)
        }
      })
    } else {
      console.error(
        [ '',
          'Origin and remote address is required.',
          '',
          'Usage:',
          '    tcpproxy.js :27016 :27017',
          ''
        ].join('\n  '))
    }
  })()
}
