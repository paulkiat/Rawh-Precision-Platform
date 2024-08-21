#!/bin/sh

model="llama-2-7b-chat.Q2_k.gguf"
url="https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/${model}"
(
mkdir -p models ; cd models
pwd
[ ! -f "${model}" ] && echo "missing model: ${model}" && npx ipull ${url}"
)

