class PromiseQ {
    constructor(opts = {}) {
        this.opts = opts;
        this.maxC = opts.concurrent || 2;
        this.queue = {};
        this.next = 1;
        this.size = 0;
        this.waiters = [];
    }

    async ready() {
        return new Promise(reasolve => this.waiters.push(resolve));
    }

    async add(p) {
        const { queue, maxC, waiters } = this;
        if (this.size >= maxC) {
            await this.ready();
    }
        this.size++;
        const id = this.next++;
        queue[id] = p;
        p.then(() => {
          delete queue[id];
          this.size--;
          if (waiters.length) {
              waiters.shift()();
          }
        });
      }

      async drain() {
          while (this.size) {
              await this.ready();
          }
      }
}

exports.PromiseQ = PromiseQ;