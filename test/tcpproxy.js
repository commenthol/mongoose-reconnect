#!/usr/bin/env node

/**
 * a tcp proxy
 *
 * @license MIT
 * @copyright 2015 commenthol
 */

'use strict';

// break if mocha tests are running
if (typeof describe === 'function') return;

var net = require('net');

/**
 * tcp proxy
 * @param {String} origin - address and port, e.g. ':3000' or '0.0.0.0:3000'
 * @param {String} remote - address and port, e.g. ':1000' or '192.168.178.1:1000'
 */
function TcpProxy(origin, remote) {
	var self = this;

	self.options = {
		origin: TcpProxy.addressPort(origin),
		client: TcpProxy.addressPort(remote),
	};

	self.server = net.createServer(function(origin) {
		var client = new net.Socket();

		client.connect(self.options.client.port, self.options.client.address, function(){
			origin.pipe(client).pipe(origin);
		});

		function closeHandler() {
			origin.end();
			client.end();
		}

		origin.once('close', closeHandler);
		client.once('close', closeHandler);
	});
}

/**
 * split string into address and port
 * @param {String} str - address and port, e.g. ':3000' or '0.0.0.0:3000'
 * @return {Object} - `{ address: {String}, port: {Number} }`
 */
TcpProxy.addressPort = function addressPort(str) {
	str += '';
	var tmp = str.match(/^(.*):(\d+)$/);
	if (tmp.length >= 3) {
		return {
			address: tmp[1] ||  '127.0.0.1',
			port: parseInt(tmp[2], 10)
		};
	}
}

TcpProxy.prototype = {
	/**
	 * open proxy
	 * @param {Function} callback - callback function
	 */
	open: function(callback) {
		var self = this;

		self.server.listen(self.options.origin.port, self.options.origin.address, function(err){
			callback && callback(err);
		});
	},

	/**
	 * close proxy
	 * @param {Function} callback - callback function
	 */
	close: function(callback) {
		this.server.close(function(err){
			callback && callback(err);
		});
	},
};

module.exports = TcpProxy;

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
	(function(){
		var argv = process.argv.slice();
		argv.splice(0,2);
		if (argv.length === 0) {
			argv = [':27016',':27017'];
		}
		if (argv.length === 2) {
			var proxy = new TcpProxy(argv[0], argv[1]);
			proxy.open(function(err){
				//console.log('proxy open', Date.now())
				if (err) {
					console.error(err);
				}
			});
		}
		else {
			console.error('\
Origin and remote address are required.\n\
\n\
Usage:\n\
    tcpproxy.js :27016 :27017\n\
');
		}
	})();
}
