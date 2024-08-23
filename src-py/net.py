# python -m venv .venv
# source .venv/bin/activate
# pip install pyzmq

import asyncio
import json
import uuid
import time
import zmq
import zmq.asyncio

proto = "tcp"
settings = {
    "heartbeat": 1000, # in milliseconds
    "dead_client": 5000, # in milliseconds
}

def zmq_client(host="127.0.0.1", port=6000):
    context = zmq.asyncio.Context()
    sock = context.socket(zmq.DEALER)
    sock.connect(f"tcp://{host}:{port}")
    print(f"connected:{host}:{port}")

    def send(request):
      sock.send_json(request)

    def recv():
      result = await sock.recv_json()
      return result
  
    async def call(request):
      await send(request)
      return await recv()

    return { "send": send, "recv": recv, "call": call }

def zmq_node(host="127.0.0.1", port=6000):
    client = zmq_client(host, port)
    handlers = {}
    subs = {}
    once = {}
    seed = int(time.time())
    lastHB = float('inf')
    on_reconnect = None
    substar = []

    async def heartbeat_loop():
      while True:
        await client["send"](seed)
        await asyncio.sleep(settings["heartbeat"])

    asyncio.create_task(heartbeat())

    async def heartbeat(rec):
        nonlocal lastHB
        if rec != lastHB:
          if lastHB != float('inf'):
              for topic in subs.keys():
                  await client['send'](["sub", topic])
                  print('proxy re-sub', topic)
              if on_reconnect:
                  on_reconnect()
          lastHB = rec
        

    async def next_message():
        rec = await client['recv']()

        if isinstance(rec, int):
            await heartbeat(rec)
            return

        # assuming rec is a list with the structure [topic, msg, cid, mid]
        if len(rec) < 4:
            print(f"Invalid message format: {rec}")
        
        topic, msg, cid, mid = rec
      
        if topic == "":
            # this is a reply to a direct call
            reply = once.get(mid)
            if not reply:
                print(f"Missing once reply: {mid}")
                return
            await reply(msg, topic, cid)
            return

        if mid == "":
            # this is a direct call with no reply path
            endpoint = handlers.get(topic) or (handlers.get(self_key))
            if endpoint:
                await endpoit(msg, cid, topic)
            return

        # check for direct call expecting a reply
        if topic and mid:
            endpoint = handlers.get(topic)
            if not endpoint:
                print(f"Missing call handler: {mid}")
                return
            rmsg = await endpoint(msg, topic, cid)
            await client["send"](["repl", '', rmsg, cid, mid])
            return

        # Handle subscriptions
        endpoint = subs.get(topic)
        if endpoint:
            await endpoint(msg, cid, topic)
            return

        # Handle wildcard subscription
        for star in substar:
            if topic.startswith(star):
                wildcard_enpoint = subs.get(f"{star}*")
                if wildcard_enpoint:
                    await wildcard_enpoint(msg, cid, topic)
                    return
        
        # Catch-all subscription
        star_endpoint = subs.get('*')
        if star_endpoint:
            await star_endpoint(msg, cid, topic)
            return

        print(f"Unhandled message: {rec}")

    async def background_message_receiver():
        while True:
            await next_message()

    def flat(topic):
        return '/'.join(topic) if isinstance(topic, list) else topic

    def _subscribe(topic, handler):
        topic = flat(topic)
        client["send"](["sub", topic])
        subs[topic] = handler
        update_substar()

    def call_handler(cid, topic, message, on_reply):
        mid = util_uid()
        once[mid] = on_reply
        client["send"](["call", flat(topic), message, cid, mid])
    
    def handle_handler(topic, handler):
        client["send"](["handle", flat(topic)])
        handlers[flat(topic)] = handler

    def locate_handler(topic, on_reply):
        mid = util_uid()
        once[mid] = on_reply
        client["send"](["locate", flat(topic, '', '', mid)])
    
    def on_reconnect_handler(fn):
        global on_reconnect
        on_reconnect = fn
    
    def update_substar():
        global substar
        substar = [k[:-1] for k in subs if k.endswith("*")]
    
    async def promise_call(cid, topic, message):
        future = asyncio.get_event_loop().create_future()
        api["call"](cid, topic, message, lambda reponse: future.set_result(response))
        return await future
    
    async def promise_locate(topic):
        future = asyncio.get_event_loop().create_future()
        api["locate"](topic, lambda reponse: future.set_result(response))
        return await future

    api = {
        "publish": lambda topic, message: client['send'](["pub", flat(topic), message]),
        "subscribe": lambda topic, handler: subscribe(topic, handler),
        "call": lambda cid, topic, message, on_reply: call_handler(cid, topic, message, on_reply),
        "send": lambda cid, topic, message: client['send'](["call", flat(topic), message, cid, ""]),
        "handle": lambda topic, handler: handle_handler(topic, handler),
        "locate": lambda topic, on_reply: locate_handler(topic, on_reply),
        "on_reconnect": lambda fn: on_reconnect_handler(fn)
    }

    api["promise"] = {
        "call": promise_call,
        "locate": promise_locate
    }

    # background message receiver
    asyncio.create_task(background_message_receiver())

    # background node heartbeat
    asyncio.create_task(heartbeat_loop())

    return api

# Example usage
async def main():
    node = zmq_node()
    
    async def handle_message(msg, cid, topic): 
        print(f"'{topic}' msg from [{cid}]: '[{msg}]'")

    counter = 0
    while counter < 20:
      node ["publish"]("count_topic", f"count = {counter}")
      await asyncio.sleep(1)
      counter += 1

    # Create an asyncio Event that is never set
    # and wait on it to keep the event loop running
    await asyncio.Event().wait()

if __name__ == "__main__":
    asyncio.run(main())
