var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var proxy = require('express-http-proxy');
var moment = require('moment');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var reg = /AS "shift_([0-9]+)_(years|months|weeks|days|hours|minutes|seconds)"/;
var from = /(time > )([0-9]+)(ms)/;
var to = /(time < )([0-9]+)(ms)/;

function fix_query_time(q, reg, count, unit) {
    var match = q.match(reg);
    if (match) {
        var time = moment(parseInt(match[2], 10));
        time.subtract(count, unit);
        return q.replace(reg, match[1] + time.valueOf() + match[3]);
    } 
    return q;
}

app.use("/", proxy(process.env.INFLUXDB, {
    preserveHostHdr: true,
    forwardPath: function(req, res) {
        var match;
        if ((req.url.indexOf("/query") === 0) && (req.query.q)) {
            var query = req.query.q.replace(/^;+/, '');
            var parts = query.split(';').map(function (q, idx) {
                var match = q.match(reg);
                if (match) {
                    if (!req.proxyShift) {
                        req.proxyShift = {};
                    }
                    req.proxyShift[idx] = {
                        count: parseInt(match[1], 10),
                        unit: match[2]
                    };
                    var select = fix_query_time(q, from, parseInt(match[1], 10), match[2]);
                    select = fix_query_time(select, to, parseInt(match[1], 10), match[2]);
                    return select;
                } else {
                    return q;
                }
            });
            var ret = Object.assign({}, req.query, {
                q: parts.join(';')
            });
            var queries = [];
            for (var key in ret) {
                if (ret.hasOwnProperty(key)) {
                    queries.push(key + "=" + encodeURIComponent(ret[key]));
                }
            }
            return "/query?" + queries.join("&"); 
        } else {
            return req.url;
        }
    },
    intercept: function(rsp, data, req, res, next) {
        var json = JSON.parse(data.toString());
        if (req.proxyShift && Object.keys(req.proxyShift).length && json.results) {
            var results = json.results.map(function (result, idx) {
                if (req.proxyShift[idx] && result.series) {
                    return Object.assign({}, result, { 
                        series: result.series.map(function (serie) {
                            return Object.assign({}, serie, { values: serie.values.map(function (item) {
                                var time = moment(item[0]);
                                time.add(req.proxyShift[idx].count, req.proxyShift[idx].unit);
                                return [ time.valueOf(), item[1]];
                            })});
                        })
                    });
                }
                return result;
            });
            json.results = results;
            return next(null, JSON.stringify(json));
        }
        return next(null, data);
    }
}));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
