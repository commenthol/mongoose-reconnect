/**
 * @license MIT
 * @copyright 2015 commenthol
 */

'use strict';

var mongoose = require('mongoose');
var m = require('mergee');

// enum
var NOOP = 0;
var RECONNECTING = 1;

function noop (callback){
	callback && callback();
}

/**
 * Handle connection reconnects
 *
 * #### Example
 *
 * ```js
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
 * ```
 *
 * @class Reconnect
 * @param {String} uri - database uri for connection
 * @param {Object} options - mongoose options for `createConnection`
 * @param {Boolean} [options.connect] - set `false` to explicitely use `connect` method to connect.
 * @param {Function} callback - of type `function(err, data)`
 */
function Reconnect(uri, options, callback) {
	if (!(this instanceof Reconnect)){
		return new Reconnect(uri, options);
	}
	this.uri = uri;
	this.options = m.extend({
			connect: true,
			db: {
				numberOfRetries:  0,
				bufferMaxEntries: 0,
				retryMiliSeconds: 500
			}
		}, options);
	this.connection;

	if (this.options.connect) {
		this.connect(callback);
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
	model: function(name, schema, collection) {
		var self = this;
		return function() {
			var conn = self.connection;
			if (conn.readyState === 0) {
				if (self.options.connect) {
					self.connect();
				}
				return;
			}
			else if (conn.readyState > 1) {
				return;
			}
			return conn.model(name, schema, collection);
		};
	},

	/**
	 * Check if connection is still connected to database
	 * @return {Boolean} true if connected
	 */
	isConnected: function (){
		var conn = this.connection;
		return (conn && conn.readyState === 1);
	},

	/**
	 * reconnect function
	 * @api private
	 */
	_reconnect: function() {
		var self = this;
		self._state = RECONNECTING;

		setTimeout(function(){
			console.log('>>>reconnect')
			self.connect();
		}, self.options.db.retryMiliSeconds || 1000);
	},

	/**
	 * Connect to the database
	 *
	 * @param {Function} callback - of type `function(err, data)`
	 */
	connect: function(callback) {
		var self = this;
		var conn = self.connection;
		var fn = noop;

		self.options.connect = true;

		if (!conn || conn.readyState === 0) {
			if (conn && conn.readyState === 0) {
				fn = self.disconnect.bind(self);
			}
			fn(function(){
				var x = Date.now()
				conn = self.connection = mongoose.createConnection(self.uri, m.omit(self.options, 'connect'));

				conn.on('error', function(err) {
				console.log('>>error', x-Date.now(), err) // TODO
					console.log(err && err.message)
					if (err && err.message === 'connect ECONNREFUSED') {
						self._reconnect();
					}
					callback && callback(err);
				});
				conn.once('open', function(){
					console.log('>>open', x-Date.now(), callback) // TODO
					callback && callback(null, conn);
				});
				conn.on('connected', function(){
					console.log('connected', conn.readyState)
				});
				conn.on('disconnected', function(){
					//~ self._reconnect();
					console.log('disconnected', conn.readyState)
				});
			});
		}
		else {
			callback && callback(null, conn);
		}

		return conn;
	},

	/**
	 * disconnect from the connection
	 * @param {Function} [callback]
	 */
	disconnect: function(callback) {
		callback = callback || noop;
		if (this.connection)
			this.connection.close(callback);
		else
			callback();
	},

};

module.exports = Reconnect;
