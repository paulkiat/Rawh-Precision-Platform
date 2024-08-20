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


## Building Docker Images

* TODO

