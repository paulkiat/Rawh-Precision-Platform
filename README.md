# Rawh Precision Platform

* Contains the code for the Rawh hub and Customer/Org deployments
* Allows building of all Docker images and npm packages
* Facilitates ease of first time setup and ongoing development


## Developer Setup

* requires node 18 or newer
* requires 15GB of free disk space


### Mac Setup

* `brew install zmq`
* `npm i`
* `scripts/seed-model.sh`


## Testing Setup

* start rawh hub server

```node src/hub/main```

* create at least one organizational entity on the hub at [http://localhost:8000](http://localhost:8000)

* start organization server using `org-id` from the hub admin page

```node src/hub/main --org-id=<org-id>```

* create at least one application for the organization at [http://localhost:9000](http://localhost:9000)

* start sample app using the `app-id` from the admin interface

```node src/app/web.js --app-id=<app-id>```

* access app directly (dev only) at [http://localhost:7000](http://localhost:7000)

* access app through org proxy at [http://localhost:9000/app/\<app-id>\>](http://localhost:9000/app/\<app-id\>)


## Web App Access

The Org web server at port `9000` will proxy calls to the app server under
the `/app/[app-id]` urls. Each app also serves their own content directly
for testing.

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


## LLM API package

`src/llm` contains llm-related services. To run these, the script
`script/seed-model.sh` needs to be run to get a basic quantized
llama-2-7b model for running locally and testing.

## Building Docker Images

This is still TBD, but will involve running a script like `scripts/build.sh`
where each docker image will have its own build directory inder `src-dock`

## Source Tree

| directory | description |
|-----------|-------------|
| `src/app` | organization application api-based services |
| `src/cli` | command line utilities and wrappers for testiing |
| `src/hub` | rawh hub that all customer organizations connect to |
| `src/lib` | libraries share by hub, org, apps |
| `src/llm` | llm-related services: embed, chat, etc |
| `src/org` | organization based services (proxy, web, meta, license) |
| `src-dock`| build directories for all docker image types based on this repo |
| `src-py`  | python libraries ported from js (`lib/net`) |
| `src-react` |a sample react app for testing |
| `web/app` | a sample org app for testing apis |
| `web/hub` | web admin interface for rawh hub |
| `web/org` | web admin and proxy interface for organization |