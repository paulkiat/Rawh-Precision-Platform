#!/bin/bash

(
  echo "building proxy container"
  docker-compose -f src/dock/proxy/docker-compose.yml -p rawh build
)