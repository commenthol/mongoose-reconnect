/**
 * reconnect tests
 *
 * @license MIT
 * @copyright 2015 commenthol
 */

'use strict';

/*global describe, it */

var assert = require('assert');
var async = require('async');

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var proxy = require('./lib/startstop')(':27016', ':27017');
var reconnect = require('../index');

// configuration
var config = {
	uri: 'mongodb://localhost:27016',
	timeout: 10,
};

// mongoose schema definition - here no schema
var anySchema = new Schema({ any: Schema.Types.Mixed });

// test functions
var t = {
	find: function (model, timeout, cb) {
		setTimeout(function(){
			if (! model()) {
				return cb (new Error('no connection'));
			}
			model().find({}, function(err, data){
				//~ console.log(err, data);
				cb(err, data);
			});
		}, (timeout || config.timeout));
	},
	noConnection: function(model, timeout){
		return function(cb) {
			t.find(model, timeout, function(err, data){
				cb(null, (err && typeof err.message === 'string') || false);
			});
		};
	},
	hasConnection: function(model, timeout) {
		return function(cb) {
			t.find(model, timeout, function(err, data){
				cb(null, (err === null) || false);
			});
		};
	},
	proxyCreate: function(cb) {
		proxy.create(function(){
			cb();
		});
	},
	proxyClose: function(cb) {
		proxy.close();
		cb();
	},
};

describe('#reconnect - no connection on startup', function(){
	it('test', function(done){
		var db = reconnect(config.uri);
		var model = db.model('any', anySchema, 'annies');

		async.series([
			t.proxyClose,
			t.noConnection(model, 200),
			t.noConnection(model),
		], function(err, data){
			db.disconnect();
			proxy.close();
			assert.ok(data.indexOf(false) === -1, JSON.stringify(data));
			done();
		});
	});
});

describe('#reconnect - connection on startup', function(){
	it('test', function(done){
		var db = reconnect(config.uri, { connect: false });
		var model = db.model('any', anySchema, 'annies');

		async.series([
			t.proxyClose,
			t.proxyCreate,
			function(cb){
				db.connect(function(){
					cb();
				});
			},
			t.hasConnection(model),
			t.hasConnection(model),
		], function(err, data){
			db.disconnect();
			proxy.close();
			assert.ok(data.indexOf(false) === -1, JSON.stringify(data));
			done();
		});
	});

});

describe('#reconnect - no connection on startup then connect', function(){
	it ('test', function(done){
		var db = reconnect(config.uri);
		var model = db.model('any', anySchema, 'annies');

		async.series([
			t.proxyClose,
			t.noConnection(model),
			t.noConnection(model),
			t.proxyCreate,
			// first request reestablishes connection
			t.noConnection(model),
			t.hasConnection(model, 200), // restablishing lasts ~200ms
			t.hasConnection(model),
		], function(err, data){
			db.disconnect();
			proxy.close();
			assert.ok(data.indexOf(false) === -1, JSON.stringify(data));
			done();
		});

	});

});

describe('#reconnect - connection on startup, disconnect and connect', function(){
	it('test', function(done) {
		var db = reconnect(config.uri, { connect: false ,test: 1 });
		var model = db.model('any', anySchema, 'annies');

		async.series([
			t.proxyClose,
			t.proxyCreate,
			function(cb){
				db.connect(function(){
					cb();
				});
			},
			t.hasConnection(model),
			t.hasConnection(model),
			t.proxyClose,
			t.noConnection(model),
			t.noConnection(model),
			t.proxyCreate,
			// first request reestablishes connection
			t.noConnection(model),
			t.hasConnection(model, 200), // restablishing lasts ~200
			t.hasConnection(model),
			t.hasConnection(model),
		], function(err, data){
			db.disconnect();
			proxy.close();
			assert.ok(data.indexOf(false) === -1, JSON.stringify(data));
			done();
		});
	});
});
