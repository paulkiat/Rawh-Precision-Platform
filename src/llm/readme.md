testing all local embedding, chunking, llm, vectordb
commands should be run from this directory

the models directory could and maybe should be a smy link to larger storage device
download at least the llama-2-7b=chat.Q2_K.gguf models/ directory

copy/paste the following line into your shell

```
(
  mkdir -p models ; models
  npx ipull https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q2_K.gguf
)