#!/bin/sh

model="Hermes-3-Llama-3.1-8B.Q8_0.gguf"
url="https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/${model}"
(
  mkdir -p models ; cd models
  pwd
  [ ! -f "${model}" ] && echo "missing model: ${model}" && npx ipull ${url}"
)

