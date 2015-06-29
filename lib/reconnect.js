/**
 * @license MIT
 * @copyright 2015- commenthol
 */

'use strict'

var mongoose = require('mongoose')
var debug = require('debug')('mongoose-reconnect')

function noop (callback) {
  callback && callback()
}

/**
 * Handle connection reconnects
 *
 * @example
 * var reconnect = require('./mongoose-reconnect');
 * // let reconnect handle the mongoose connection
 * var db = reconnect('mongodb://localhost/test', { db: {}, server: {} });
 * // a schema is needed
 * var anySchema = new Schema({ any: Schema.Types.Mixed });
 * // register the model
 * var model = db.model('any', anySchema, 'annies');
 *
 * // your custom find
 * function find (query, callback) {
 *   if (!model()) return callback(new Error('no connection'));
 *   modell().find(query).exec(callback);
 * }
 *
 * find({}, function(err, data){
 *   // ...
 * });
 *
 * @class Reconnect
 * @param {String} uri - database uri for connection
 * @param {Object} options - mongoose options for `createConnection`
 * @param {Boolean} [options.connect] - set `false` to explicitely use `connect` method to connect.
 * @param {Function} callback - of type `function(err, data)`
 */
function Reconnect (uri, options, callback) {
  if (!(this instanceof Reconnect)) {
    return new Reconnect(uri, options)
  }
  this.uri = uri
  this.options = Object.assign({
    connect: true,
    db: {
      numberOfRetries: 0,
      bufferMaxEntries: 0,
      retryMiliSeconds: 500
    }
  }, options)
  this.connection
  this.count = 0

  if (this.options.connect) {
    this.connect(callback)
  }
}

Reconnect.prototype = {
  /**
   * Register model from connection
   *
   * Reconnects if connection has gone
   *
   * @param {String} name - name of model
   * @param {Object} schema - mongoose.Schema
   * @param {String} [collection] - collection name
   * @return {Function} function itself returns the model using the named schema for the optional collection. If null is returned then connection has been lost.
   */
  model: function (name, schema, collection) {
    var self = this
    return function () {
      // mongoose.STATES = {
      //   '0': 'disconnected',
      //   '1': 'connected',
      //   '2': 'connecting',
      //   '3': 'disconnecting',
      //   '4': 'unauthorized',
      //   '99': 'uninitialized'
      // }
      var conn = self.connection
      /* istanbul ignore else */
      if (conn.readyState === 0) { // mongoose.STATES[0] === 'disconnected'
        /* istanbul ignore else */
        if (self.options.connect) {
          self.connect()
        }
        return
      } else if (conn.readyState > 1) {
        return
      }
      return conn.model(name, schema, collection)
    }
  },

  /**
   * Check if connection is still connected to database
   * @return {Boolean} true if connected
   */
  isConnected: function () {
    var conn = this.connection
    return (conn && conn.readyState === 1)
  },

  /**
   * reconnect function
   * @api private
   */
  _reconnect: function () {
    var self = this

    setTimeout(function () {
      debug('reconnect')
      self.connect()
    }, self.options.db.retryMiliSeconds || 1000)
  },

  /**
   * Connect to the database
   *
   * @param {Function} callback - of type `function(err, data)`
   */
  connect: function (callback) {
    var self = this
    var conn = self.connection
    var fn = noop

    self.options.connect = true

    if (!conn || conn.readyState === 0) {
      if (conn && conn.readyState === 0) {
        fn = self.disconnect.bind(self)
      }
      fn(function () {
        debug('connecting to %s', self.uri)
        conn = self.connection = mongoose.createConnection(self.uri, self.options)

        conn.on('error', function (err) {
          debug('error %s', err && err.message)
          /* istanbul ignore else */
          if (err && err.message.match(/ECONNRESET|ECONNREFUSED|ECONNABORTED/) && !this.count) {
            this.count++
            self._reconnect()
          } else {
            this.count = 0
            callback && callback(err)
          }
        })
        conn.once('open', function () {
          debug('open')
          callback && callback(null, conn)
        })
        conn.on('connected', function () {
          debug('connected %s', mongoose.STATES[conn.readyState])
        })
        conn.on('disconnected', function () {
          self._reconnect()
          debug('disconnected %s', mongoose.STATES[conn.readyState])
        })
      })
    } else {
      callback && callback(null, conn)
    }

    return conn
  },

  /**
   * disconnect from the connection
   * @param {Function} [callback]
   */
  disconnect: function (callback) {
    callback = callback || noop
    if (this.connection) {
      this.connection.close(callback)
    } else {
      callback()
    }
  }

}

module.exports = Reconnect
