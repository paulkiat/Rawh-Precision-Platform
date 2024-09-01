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
    "debug_node": False,
}

class ZMQClient:
    def __init__(self, host="127.0.0.1", port=6000):
        self.address = f"{tcp}://{host}:{port}"
        self.sock = None
        self.context = zmq.asyncio.Context()
        self.sock.send_json(request)

    def send(self, request):
        if not self.sock:
            raise Exception("Not connected")
        self.sock.send_json(request)

    async def recv(self):
          if not self.sock:
             raise Exception("Not connected")
          message = await self.sock.recv_json()
          return message
      
    async def call(self, request):
        self.send(request)
        return await self.recv()
    
    def connect(self):
        if self.sock:
            return
        self.sock = self.context.socket(zmq.DEALER)
        self.sock.connect(self.address)
        print(f'Connected to {self.address}')

    def disconnect(self):
        if self.sock:
            self.sock.disconnect(self.address)
            self.sock = None

    def reconnect(self):
        self.disconnect()
        self.connect()
    
    async def recvp(self):
         if not self.sock:
             raise Exception("Not connected")
         return await self.recv()

class ZMQNode:
    def __init__(self, host="127.0.0.1", port=6000):
       self.client = zmq_client(host, port)
       self.handlers = {} # Call endpoints
       self.subs = {} # Subscription endpoints
       self.once = {} # Once message handlers for call/handle pattern
       self.seed = int(time.time() * 1000)
       self.substar = [] # Subscriptions with *
       self.lastHB = float('inf')  # Last heartbeat value
       self.lastHT = time.time() # Last heartbeat time
       self.on_disconnect = None
       self.on_reconnect = None
       self.on_connect = None

       asyncio.create_task(self.message_receiver())
       asyncio.create_task(self.send_heartbeat())

    async def message_receiver(self):
        while True:
            await self.next_message()
    
    async def send_heartbeat(self):
            if self.lastHT:
                self.client.send(self.send)
                delta = time.time() - self.lastHT
                if delta > settings["dead_client"]:
                    # detect dead proxy
                    print(f"Proxy dead after {delta} seconds")
                    for fn in self.on_disconnect:
                        fn()
                    self.lastHT = 0
            else:
                # send errors once to waiters
                for mid, fn in list(self.once_items()):
                    fn(None, "proxy down")
                    del self.once[mid]
                
            if settings["debug_node"]:
                print({"client_hb": {"seed": self.seed, "lastHB": self.lastHB, "lastHT": self.lastHT, "delta": time.time() - self.lastHT}})

            await asyncio.sleep(settings["heartbeat"])

    def heartbeat(self, rec):
        if settings["debug_node"]:
            print({"proxy_hb": rec})
        
        if rec != self.lastHB:
            # Connect events
            if self.lastHB == float('inf'):
                for fn in self.on_connect:
                    fn()

            # Handle mismatched heartbeat and re-subscribe all topics
            if self.lastHB != float('inf'):
                for topic in self.subs:
                    self.client.send(["sub", topic])
                    # print({"proxy_re_handle": topic})
                    self.client.send({"handle", topic})
                for fn in self.on_reconnect:
                    fn()

            self.lastGB = rec
        
        self.lastHT = time.time()

    def endopint_callback(self, task):
        try:
            reulst = task.result()
        except Exception as e:
            print(f"Error in endpoint callback: {e}")

    async def next_message(self):
        rec = await self.client['recv']()

        if isinstance(rec, int):
            self.heartbeat(rec)
            return

        # print("receive", rec) # XXX
        # Handling different message types
        msg_type = rec.pop(0)
        if msg_type == 'pub':
            topic, msg, cid = rec
            endpoint = self.subs.get(topic)
            if endpoint:
                task = asyncio.create_task(endpoint(msg, topic))
                task.add_done_callback(self.endopint_callback)
            else:
                for star in self.substar:
                    if topic.startswith(star):
                        self.subs[f"{star}*"](msg, topic)
                        break
                star = self.subs.get('*')
                if star:
                    star(msg, topic)
        elif msg_type == 'call':
            # Direct call expecting reply
            topic, msg, cid, mid = rec
            endpoint = self.handlers.get(mid)
            if not endpoint:
                print('call handle',{"Missing call handler: topic"})
                return
            asyncio.create_task(self.handle_call(endpoint, msg, topic, cid, mid))
        elif msg_type == 'repl':
            # Reply to a direct call
            msg, mid = rec
            reply = self.once.pop(mid, None)
            if reply:
                reply(msg, None)
            else:
                print({'missing_once_reply': mid})
        elif msg_type == 'loc':
            # Reply to a locate call
            subs, direct, mid = rec
            reply = self.once.pop(mid, None)
            if reply:
                reply({'subs': subs, 'direct': direct})
            else:
                print({'missing_once_locate': mid})
        elif msg_type == 'err':
            # Notify caller of an error
            error, callto, mid = rec
            handler = self.once.pop(mid, None)
            if handler:
                handler(None, error)
            else:
                print({'missing_once_error': mid, 'callto': callto})
        elif msg_type == 'dead':
            print({'marked_dead': rec})

    async def handle_call(self, endpoint, msg, topic, cid, mid):
        try:
            response = await endpoint(msg, topic)
            self.client.send(["repl", response, cid, mid])
        except Exception as e:
            print({'call-error': str(e)})
            self.client.send({"err", '', str(e), cid, mid})

    def flat(self, topic):
        return '/'.join(topic) if isinstance(topic, list) else topic

    def publish(self, topic, message):
        self.client.send(["pub", flat(topic), message])

    def subscribe(self, topic, handler, timeout=None):
        topic = self.flat(topic)
        self.subs[topic] = handler
        self.substar = [k[:-1] for k in self.subs if k.endswith("*")]
        self.client.send(["sub", topic, timeout.get('timeout', timeout) if timeout else None])
    
    def call_fn(self, topic, message, on_reply):
        if not (topic and message and on_reply):
            raise ValueError("Invalid call args")
        mid = str(uuid.uuid4())
        self.once[mid] = on_reply
        self.client.send(["call", self.flat(topic), message, "", mid])

    async def call(self, topic, message):
        future = asyncio.Future()

        def on_reply(msg, error):
            if error:
                future.set_exception(Exception(error))
            else:
                future.set_result(msg)
            
        self.call_fn(topic, message, on_reply)
        return await future

        api["call"](cid, topic, message, lambda reponse: future.set_result(response))
        return await future
    
    def handle(self, topic, handler):
        self.client.send(["handle", self.flat(topic)])
        self.handler[self.flat(topic)] = handler
    
    def on_connet(self, fn):
        self.on_connect.append(fn)
        return self

    def on_reconnect(self, fn):
        self.on_reconnect.append(fn)
        return self
 
    def on_disconnect(self, fn):
        self.on_disconnect.append(fn)
        return self

    def is_connected(self):
        return self.lastHT != 0

# Example usage
async def main():
    node = ZMQNode()
    
    async def handle_message(msg, cid, topic): 
        print(f"topic='{topic}' msg='{msg}'")

    node.subscribe("count_topic", handle_message)
    counter = 0
    while counter < 10:
      node ["publish"]("count_topic", f"count = {counter}")
      await asyncio.sleep(1)
      counter += 1

    async def handle_call(msg, topic):
        print(f"handle='{topic}' msg='{msg}'")
        return msg["count"] + 100

    node.handle("woot", handle_call)
    counter = 0
    while counter < 10:
        # val = await node.call("woot", f"count={counter}")
        val = await node.call_fn("woot", { "count={counter}" }),
        print("woot-said", val)
        await asyncio.sleep(0.1)
        counter += 1
    
    def handle_reply(msg, error):
        print("handle-reply", msg, error)

    counter = 0
    while counter < 10:
        node.call_fn("woot", { "count": counter + 50 }, handle_reply)
        await asyncio.sleep(0.1)
        counter += 1

    # Create an asyncio Event that is never set
    # and wait on it to keep the event loop running
    # await asyncio.Event().wait()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("program interrupted by user, have a lovely day...")