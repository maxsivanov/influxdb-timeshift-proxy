# Timeshift influxDB proxy

This proxy server will add *timeshift* feature to you *influxDB* server. This feature is extremely helpful to compare periods in *Grafana*.

## Installation

```
git clone https://github.com/maxsivanov/influxdb-timeshift-proxy.git
cd influxdb-timeshift-proxy
npm i
INFLUXDB=192.168.33.11:8086 npm run start 
```

Proxy will be available on port 8089.  

## Usage

Proxy will go timeshift on queries with fields listed with alias `AS "shift_1_weeks"`. `1` can be any positive integer number. `weeks` can be`years|months|weeks|days|hours|minutes|seconds`.

## Example requests

Shift one week back:

```
SELECT non_negative_derivative("value", 1h) AS "shift_1_weeks" FROM "CPU_LOAD" WHERE "tag" = 'all' 
```

Shift two days back:

```
SELECT non_negative_derivative("value", 1h) AS "shift_2_days" FROM "CPU_LOAD" WHERE "tag" = 'all' 
```
