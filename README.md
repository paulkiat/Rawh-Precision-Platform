# Rawh Precision Platform

* Contains the code for the Rawh hub and Customer/Org deployments
* Allows building of all Docker images and npm packages
* Facilitates ease of first time setup and ongoing development


## Developer Setup

### Mac Setup

* `brew install zmq`
* `npm i`


## Testing Setup

* start rawh hub server

```node src/hub/main```

* create at least one organizational entity

```curl "http://localhost:8000/org.create?name=company_x&creator=my_name"```

* start customer / organization server using _orgid_ returned from last command

```node src/hub/main --app-port=5555 --org-id=<org-id>```

* build react app and copy into location to be served by app node(s)

```
cd src-react/sample
npm run build
cp -r build ../../web/app/sample1
cp -r build ../../web/app/sample2
cd -
```

* start sample react app node 1

```node src/app/main.js --app-id=sample1 --app-port=7001```

* start sample react app node 2

```node src/app/main.js --app-id=sample1 --app-port=7002```


## Web App Access

The Org web server in `5555` will proxy calls to the app server under
the `/app/[appname]` urls. Each app also serves their own content directly
for testing. `localhost:7001/app/sample1` is served through `localhost:5555/app/sample1`
for example.

In production, you would not use the `--app-port` setting to the org server.
Instead, it would serve web traffic only through port `443`. When key/cert files
are *not* provided to the org environment (as a directory name), then then
system will auto-generate a self-signed cert for teting.


## LevelDB NoSQL Storage

The Hub and Org servers use LevelDB as a back-end NoSQl store
for meta-data and logging. This is a REST api available from
localhost only. By default the **hub** webmin port is `8000` and
the **org** webmin port is `9000`.

To query *all* records in the meta-data store on the hub, for example:

```
curl "http://localhost:8000/meta.recs"
```

To query *only* organizational records using a sub-level:

```
curl "http://localhost:8000/meta.recs?sub=org"
```

Look in `src/util/store.js` under the `web_admin()` function to
get a list of supported commands from the switch statement.


## Building Docker Images

* TODO

