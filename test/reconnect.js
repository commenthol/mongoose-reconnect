/**
 * reconnect tests
 *
 * @license MIT
 * @copyright 2015 commenthol
 */

'use strict'

/* global describe, it */

if (typeof Object.assign !== 'function') {
  // polyfill for version <= 0.12.x
  require('core-js/fn/object/assign')
}

var assert = require('assert')
var async = require('asyncc')

var mongoose = require('mongoose')
mongoose.Promise = global.Promise
var Schema = mongoose.Schema

var reconnect = require('..')
var TcpProxy = require('./tcpproxy.js')
var proxy = new TcpProxy(':27016', ':27017')

// configuration
var config = {
  uri: 'mongodb://localhost:27016',
  timeout: 10
}

// mongoose schema definition - here no schema
var anySchema = new Schema({
  any: Schema.Types.Mixed
})

// test functions
var t = {
  find: function (model, timeout, cb) {
    setTimeout(function () {
      if (!model()) {
        return cb(new Error('no connection'))
      }
      model().find({}, function (err, data) {
        // console.log(err, data);
        cb(err, data)
      })
    }, (timeout || config.timeout))
  },
  noConnection: function (model, timeout) {
    return function (cb) {
      t.find(model, timeout, function (err, data) {
        cb(null, (err && typeof err.message === 'string') || false)
      })
    }
  },
  hasConnection: function (model, timeout) {
    return function (cb) {
      t.find(model, timeout, function (err, data) {
        cb(null, (err === null) || false)
      })
    }
  },
  proxyCreate: function (cb) {
    proxy.control('listen', cb)
  },
  proxyClose: function (cb) {
    proxy.control('close', cb)
  },
  proxyRefuse: function (cb) {
    proxy.control('refuse', cb)
  },
  proxyReset: function (cb) {
    proxy.control('reset', cb)
  }
}

describe('#reconnect', function () {
  it('should call callback on disconnect if there is no connection', function (done) {
    var db = reconnect(config.uri, {connect: false})
    db.disconnect(done)
  })

  it('should not connect if there is no connection on startup', function (done) {
    var db = reconnect(config.uri)
    var model = db.model('any', anySchema, 'annies')

    async.series([
      t.proxyClose,
      t.noConnection(model, 200),
      t.noConnection(model)
    ], function (err, data) {
      db.disconnect()
      assert.ok(!err, '' + err)
      assert.ok(data.indexOf(false) === -1, JSON.stringify(data))
      proxy.control('close', done)
    })
  })

  it('should connect if connection available on startup', function (done) {
    var db = reconnect(config.uri, {
      connect: false
    })
    var model = db.model('any', anySchema, 'annies')

    async.series([
      t.proxyClose,
      t.proxyCreate,
      function (cb) {
        db.connect(function () {
          cb()
        })
      },
      t.hasConnection(model),
      t.hasConnection(model),
      function (cb) {
        assert.ok(db.isConnected())
        cb()
      }
    ], function (err, data) {
      db.disconnect()
      assert.ok(!err, '' + err)
      assert.ok(data.indexOf(false) === -1, JSON.stringify(data))
      proxy.control('close', done)
    })
  })

  it('should connect if no connection on startup', function (done) {
    var db = reconnect(config.uri)
    var model = db.model('any', anySchema, 'annies')

    async.series([
      t.proxyClose,
      t.noConnection(model),
      t.noConnection(model),
      t.proxyCreate,
      t.hasConnection(model, 200), // restablishing lasts ~200ms
      t.hasConnection(model)
    ], function (err, data) {
      db.disconnect()
      assert.ok(!err, '' + err)
      assert.ok(data.indexOf(false) === -1, JSON.stringify(data))
      proxy.control('close', done)
    })
  })

  it('connection on startup, disconnect and connect', function (done) {
    var db = reconnect(config.uri, {
      connect: false,
      test: 1
    })
    var model = db.model('any', anySchema, 'annies')

    async.series([
      t.proxyCreate,
      function (cb) {
        db.connect(function () {
          cb()
        })
      },
      t.hasConnection(model),
      t.hasConnection(model),
      t.proxyClose,
      t.noConnection(model),
      t.noConnection(model),
      t.proxyCreate,
      t.hasConnection(model, 100), // restablishing lasts ~200
      t.hasConnection(model),
      t.hasConnection(model)
    ], function (err, data) {
      db.disconnect()
      assert.ok(!err, '' + err)
      assert.ok(data.indexOf(false) === -1, JSON.stringify(data))
      proxy.control('close', done)
    })
  })

  it('should connect on startup, disconnect and connect', function (done) {
    var db = reconnect(config.uri, {
      connect: false,
      test: 1
    })
    var model = db.model('any', anySchema, 'annies')

    async.series([
      t.proxyCreate,
      function (cb) {
        db.connect(function () {
          cb()
        })
      },
      t.hasConnection(model),
      t.hasConnection(model),
      t.proxyClose,
      t.noConnection(model),
      t.noConnection(model),
      t.proxyCreate,
      t.hasConnection(model, 100), // restablishing lasts ~200
      t.hasConnection(model),
      t.hasConnection(model)
    ], function (err, data) {
      db.disconnect()
      assert.ok(!err, '' + err)
      assert.ok(data.indexOf(false) === -1, JSON.stringify(data))
      proxy.control('close', done)
    })
  })

  it('should reconnect after ECONNREFUSED', function (done) {
    var db = reconnect(config.uri, {
      connect: false,
      db: {retryMiliSeconds: 50}
    })
    var model = db.model('any', anySchema, 'annies')

    async.series([
      t.proxyCreate,
      function (cb) {
        db.connect(function () {
          cb()
        })
      },
      function (cb) {
        var err = new Error('connect ECONNREFUSED')
        err.code = 'ECONNREFUSED'
        db.connection.emit('error', err)
        cb()
      },
      t.proxyCreate,
      t.hasConnection(model, 100), // restablishing lasts ~200
      t.hasConnection(model),
      t.hasConnection(model)
    ], function (err, data) {
      db.disconnect()
      assert.ok(!err, '' + err)
      assert.ok(data.indexOf(false) === -1, JSON.stringify(data))
      proxy.control('close', done)
    })
  })
})
