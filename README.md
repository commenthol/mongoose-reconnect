# mongoose-reconnect

> Reconnect mongoose connections

[![NPM version](https://badge.fury.io/js/mongoose-reconnect.svg)](https://www.npmjs.com/package/mongoose-reconnect/)
[![Build Status](https://secure.travis-ci.org/commenthol/mongoose-reconnect.svg?branch=master)](https://travis-ci.org/commenthol/mongoose-reconnect)

Reliable reconnect to a [mongoDB][] instance using [mongoose][] driver.

## Table of Contents

<!-- !toc (minlevel=2 omit="Table of Contents") -->

* [Description](#description)
  * [Example](#example)
* [Motivation](#motivation)
  * [First connect](#first-connect)
  * [Reconnect after failure](#reconnect-after-failure)
* [Solution](#solution)
  * [First connect](#first-connect)
  * [Reconnect after failure](#reconnect-after-failure)
* [Contribution and License Agreement](#contribution-and-license-agreement)
* [License](#license)

<!-- toc! -->

## Description

`reconnect` handles the database connection and the [mongoose][] models for you.

### Example

```js
var reconnect = require('./mongoose-reconnect');
// let `reconnect` handle the mongoose connection
var db = reconnect('mongodb://localhost/test', { db: {}, server: {} });
// a schema is needed
var anySchema = new Schema({ any: Schema.Types.Mixed });
// register the model
var model = db.model('any', anySchema, 'annies');

// your custom find
function find (query, callback) {
  if (!model()) {
    // react if the connection has gone
    return callback(new Error('no connection'));
  }
  modell().find(query).exec(callback);
}

find({}, function(err, data){
  // ...
});
```

## Motivation

### First connect

To connect the [mongoose][] driver to a [mongoDB][] instance a
connection is required. This implies that a mongoDb needs to run before
any nodeJs Server. In this case a nodeJS server reboot is necessary
This needs to be done from outside, e.g. manually by your admin or
automatically by [forever][], [pm2][], [monit][].

__Try it:__

```bash
# start your mongoDB instance or this docker container
$ ./scripts/mongo.sh
# start querying the database
$ node test/database.js --disable
# you'll get
Error
    at Object.<anonymous> (mongoose-reconnect/node_modules/mongoose/...
```

### Reconnect after failure

If your database locks up during operations [mongoose][] only retries
to a certain number of retries before giving up, which also means that
you need to restart your nodeJS server from outside.

__Try it:__

```bash
# start a proxy which allows to cut the connection
$ node test/tcpproxy.js
# start querying the database
$ node test/database.js --disable
```

Now kill `tcpproxy` with `CTRL+C` and wait 1min time. Then restart
`tcpproxy` again. Do this several times until you only see the same
error messages. I.e. the reconnection to the database did not happen,
as we do not see the search results.

From my understanding this is an issue with the native mongoDB driver.

## Solution

Retry the same steps above without the `--disable` option.

### First connect

1. Start `node test/database.js`
2. From another terminal start `node test/tcpproxy.js`

```bash
$ node test/database.js
0 '2015-05-02T08:52:31.090Z'
>>>no connection
1 '2015-05-02T08:52:31.201Z'
... // tcproxy connected
17 '2015-05-02T08:53:29.189Z'
17 '2015-05-02T08:53:29.213Z' null []
```

### Reconnect after failure

1. Start `node test/database.js`
2. From another terminal start `node test/tcpproxy.js`
3. Stop `tcpproxy` with `CTRL+C`
4. Start `tcpproxy` after some time.

## Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your
code to be distributed under the MIT license. You are also implicitly
verifying that all code is your original work or correctly attributed
with the source of its origin and licence.

## License

Copyright (c) 2015- commenthol (MIT License)

See [LICENSE][] for more info.

[LICENSE]: ./LICENSE

[mongoose]: http://mongoosejs.com
[monit]: http://mmonit.com
[pm2]: http://pm2.keymetrics.io/
[forever]: https://github.com/foreverjs/forever
[mongoDB]: https://www.mongodb.org
