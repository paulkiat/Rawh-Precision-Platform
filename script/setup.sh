#!bin/bash

mkdir -p build
cd build
[ ! -d llamap.cpp ] && git clone https://github.com/ggreganov/llama.cpp.git
[ ! -d node-llama.cpp ] && git clone https://github.com/withcatai/node-llama-cpp.git
[ ! -f llama/llama.cpp ] && (
    cd node-llama-cpp
    git checkout bet
    ( cd llama && ln -s ../../llama.cpp . )
    npm i
    npm run dev:build
    npm link
)
npm link node-llama-cpp