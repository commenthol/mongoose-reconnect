#!/usr/bin/env node

/**
 * test script to manually test reconnection
 *
 * @license MIT
 * @copyright 2015 commenthol
 *
 * Usage:
 *
 * 1. Start this script with `node database.js`
 * 2. In another terminal start the tcpproxy with `node tcpproxy.js`
 * 3. Kill tcproxy with `CTRL+C` ... restart again
 */

'use strict'

// break if mocha tests are running
if (typeof describe === 'function') return

var mongoose = require('mongoose')
var Schema = mongoose.Schema
var reconnect = require('../')

var config = {
  uri: 'mongodb://localhost:27016/test',
  timeout: 1000,
  options: {
    connect: false,
    db: { // node_modules/mongoose/node_modules/mongodb/lib/db.js
      // loggerLevel: 'debug',
      numberOfRetries: 0,
      retryMiliSeconds: 500,
      bufferMaxEntries: 0
    },
    server: {
      // loggerLevel: 'debug',
      // auto_reconnect: false,
      socketOptions: { // node_modules/mongoose/node_modules/mongodb/lib/server.js
        // autoReconnect: false,
        // connectTimeoutMS: 15000,
        // socketTimeoutMS: 60000,
        keepAlive: 1
      }
      // reconnectTries: 10000,
      // reconnectInterval: 1000,
    }
  }
}

var anySchema = new Schema({ any: Schema.Types.Mixed })

var db,
  model

var count = 0

function loop () {
  (function (cnt) {
    console.log(cnt, (new Date()).toISOString())

    if (!model()) {
      return console.log('>>>no connection')
    }
    model().find({}, function (err, data) {
      console.log(cnt, (new Date()).toISOString(), err, data)
    })
  })(count++)
}

if (~process.argv.indexOf('--disable')) {
  // without reconnect
  console.log('INFO: reconnect disabled')
  db = mongoose.createConnection(config.uri, config.options)
  model = function () { return db.model('any', anySchema, 'annies') }

  db.on('error', function (err) {
    console.error(err)
    // db.close(function(){
      // process.exit(1);
    // });
  })
  db.on('connected', function () {
    console.log('#connected')
  })
  db.on('disconnected', function () {
    console.log('#disconnected')
  })
  db.once('open', function () {
    setInterval(loop, config.timeout)
  })
} else {
  // with reconnect
  db = reconnect(config.uri, config.options)
  model = db.model('any', anySchema, 'annies')
  db.connect(function () {
    setInterval(loop, config.timeout)
  })
}
