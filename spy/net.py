# pip install pyzmq

import asyncio
import zmq
import zmq.asyncio

async def zmq_client(host="127.0.0.1", port=6000):
  context = zmq.asyncio.Context()
  sock = context.socket(zmq.DEALER)
  sock.connect(f"tcp://{host}:{port}")
  printf('Client connected to {host}:{port}')

  async def send(request):
    await sock.send_json(request)

  async def recv():
    return await sock.recv_json()
  
  async def call(request):
    await send(request)
    return await recv()

  return { 'send': send, 'recv': recv, 'call': call }

async def zmq_node(host="127.0.0.1", port=6000):
  client = await zmq_client(host, port)
  handlers = {}

  async def receiver():
    while True:
      [ topic, msg, cid ] = await client.recv()

      if topic:
        handler = handlers.get(topic, handlers.get("{self}"))
        if handler:
          handler(msg, cid)
        else:
          print(f"Missing handler for topic: {topic}")
      else:
        print("No topic received", {"msg": msg, "cid": cid})

  asnycio.create_task(receiver())

  async def publish(topic, message):
    await client['send']([ "pub", topic, message ])

  async def subscribe(topic, handler):
    await client['send']([ "sub", topic ])
    handlers[topic] = handler
  
  async def on_direct(handler):
    await client['send']([ "sub", ""])
    handler["{self}"] = handler

  return { 'publish': publish, 'subscribe': subscribe, 'on_direct': on_direct }

# Example usage
async def main():
  node = await zmq_node()
  await node["subscribe"]("example_topic", lambda msg, cid: print(f"Message from {cid}: {msg}"))
  # await node["publish"]("example_topic", "Hello, World!")

  counter = 0
  while True:
    message = f"Hello, World! {counter}"
    await node ["publish"]("example_topic", message)
    counter += 1
    await asyncio.sleep(1) # Pause for 1 second (or any desired interval)

  # Create an asyncio Event that is never set
  # and wait on it to keep the event loop running
  await asyncio.Event().wait()

if __name__ == "__main__":
  asyncio.run(main())
