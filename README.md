# Rawh Precision Platform

* Contains the code for the Rawh hub and Customer/Org deployments
* Allows building of all Docker images and npm packages
* Facilitates ease of first time setup and ongoing development


## Dev Setup

### Mac Setup

* `brew install zmq`
* `npm i`


## Dev Startup

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


## LevelDB NoSQL Storage

The Hub and Org servers use LevelDB as a back-end NoSQl store
for meta-data and logging. This is a REST api available from
localhost only. By default the *hub* webmin port is `8000` and
the *org* webmin port is `9000`.

To query *all* records in the meta-data store on the hub, for example:

```
curl "http://localhost:8000/meta.recs"
```

Look in `src/util/store.js` under the `web_admin()` function to
get a list of supported commands from the switch statement.

## Building Docker Images

* TODO

