# pip install pyzmq

import asyncio
import zmq
import zmq.asyncio

async def zmq_client(host="127.0.0.1", port=6000):
  context = zmq.asyncio.Context()
  sock = context.socket(zmq.DEALER)
  sock.connect(f"tcp://{host}:{port}")
  print(f'Client connected to {host}:{port}')

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
  seed = asyncio.get_event_loop().time()
  self_key = "{self}"
  handlers = {}
  lastHB = float('inf')

  async def heartbeat():
    while True:
      await client['send'](seed)
      await asyncio.sleep(5) # Assuming 5 seconds for the heartbeat interval

  asyncio.create_task(heartbeat())

  async def receiver():
    nonlocal lastHB
    while True:
      rec = await client['recv']()
      if isinstance(rec, int):
        if rec != lastHB:
          if lastHB != float('inf'):
            for topic in handlers:
              await client['send'](["sub", None if topic == self_key else topic])
              print('proxy re-sub', topic)
            lastHB = rec
          continue

      topic, msg, cid = rec
      if topic:
        handler = handlers.get(topic) or (handlers.get(self_key))
        if handler:
          handler(msg, cid)
        else:
          print('missing handler for topic', topic)
      else:
        print('no topic recv', {"msg": msg, "cid": cid})

  asnycio.create_task(receiver())

  api = {
    "publish": lambda topic, message: asyncio.create_task(client['send']["pub", topic, message]),
    "subscribe": lambda topic, handler: _subscribe(topic, handler),
    "on_direct": lambda hanbdler: _subscribe(None, handler)
  }

  async def _subscribe(topic, handler):
    await client['send']([ "sub", topic ])
    handlers[topic if topic else self_key] = handler
  return api

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
