# Promise源码学习
- Fulfilled-Promise，被完成的Promise对象
- Rejected-Promise，被拒绝的Promise对象

## Promise的特点

### then/catch/finally都会返回一个新的Promise对象

```
// 测试then
let p1 = Promise.resolve();
let p2 = p1.then();
p2.finally(()=>{
    console.log(p1 === p2); //打印false，说明是新对象
});
```
```
// 测试catch
let p1 = Promise.reject(1);
let p2 = p1.catch();
p2.finally(()=>{
    console.log(p1 === p2); //打印false，说明是新对象
});
```
```
// 测试finally
let p1 = Promise.resolve();
let p2 = p1.finally();
p2.finally(()=>{
    console.log(p1 === p2); //打印false，说明是新对象
});
```

### 即使then/catch内部函数返回Promise对象，then/catch仍然是返回新对象，与内部函数返回的Promise有相同的执行结果

```
// 测试then
let onFulfilledRes = null;
let thenReturn = Promise.resolve()
    .then(() => {
        onFulfilledRes = Promise.resolve()
        return onFulfilledRes;
    });
thenReturn.then((v) => {
    console.log(thenReturn === onFulfilledRes); //打印false，说明是新对象
});
```
```
// 测试catch
let onRejectedRes = null;
let thenReturn = Promise.reject()
    .catch(() => {
        onRejectedRes = Promise.resolve()
        return onRejectedRes;
    });
thenReturn.then((v) => {
    console.log(thenReturn === onRejectedRes);  //打印false，说明是新对象
});
```
```
// 测试新对象的执行结果
Promise.resolve()
    .then(()=>Promise.resolve(1)) 
    .then((v)=>console.log(v)) //打印1，说明新对象和内部函数有相同的执行结果
```

### 如果onFulfilled/onRejcted返回值是Rejected-Promise，则then/catch也将会返回新的Rejected-Promise对象
```
Promise.resolve()
    .then(()=>Promise.reject(1))
    .catch((v)=>console.log(v)) // 调用了catch，打印1
```

### finally无法修改Promise状态
```
// 
Promise.resolve(1)
    .finally(() => 2)
    .then((v) => {
        console.log(v)  // 打印1
    });
```

### 可以多次调用then/catch/finally方法

```
// 测试then和finally,catch是一样的
let p = new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve(1)
    }, 1000);
});
p.then((v) => console.log(v)); //打印1
p.then((v) => console.log(v)); //打印1
p.finally(() => console.log("finally1")); //打印finally1
p.finally(() => console.log("finally2")); //打印finally2
```

### promise按事件队列进行执行

```
Promise.resolve().then(() => {
    console.log("1-1");
}).then(() => {
    console.log("1-2")
});
Promise.resolve().then(()=>{
    console.log("2-1");
    return Promise.resolve();
}).then(()=>{
    console.log("2-2")
});
Promise.resolve().then(()=>{
    console.log("3-1");
}).then(()=>{
    console.log("3-2")
});
// 打印结果
1-1
2-1
3-1
1-2
3-2
2-2
```

## 实现难点

### 构建事件队列

- 队列规则：先进先出
- 每次触发执行then/catch/finally内部函数时插入到事件队列中
- 循环执行队列处理

```
// 简易的事件队列
const queue = [];
function runQueue() {
    while (queue.length > 0) {
        let func = queue.shift();
        func && func();
    }
    setTimeout(runQueue,10)
}
```

### then/catch/finally内部函数的处理

- 内部函数处理时，需要返回一个新的Promise对象
    ```
    function runInnerFunc(promise, onFulfill, onRejected) {
        let obj = promise[randomKey];
        return new MyPromise((resolve, reject) => {
            obj.resolveWatcher.push(createWatcher(promise, resolve, reject, onFulfill));
            obj.rejectedWatcher.push(createWatcher(promise, resolve, reject, onRejected));
            obj.tryFinish();
        });
    }
    ```
- 内部函数执行时，需要通过事件队列
    ```
    function createWatcher(promise, resolve, reject, innerFunc) {
        let obj = promise[randomKey];
        return () => {
            eventQueue.addQueue(() => {
                handleInnerFuncRes(resolve, reject, innerFunc, obj.result);
            });
        };
    }
    ```
    > eventQueue 是上面封装的事件队列

- 内部函数执行结果，如果返回Promise的处理
    ```
    function handleInnerFuncRes(resolve, reject, innerFunc, result) {
        let res = innerFunc && innerFunc(result);
        if (res && res instanceof MyPromise) {
            res.then((value) => {
                resolve(value);
            }, (reason) => {
                reject(reason);
            });
        } else {
            resolve(res);
        }
    }
    ```
- finally内部函数不需要监听返回值，直接使用父级的返回值即可。
    ```
    function createFinallyWatcher(promise, resultFunc, innerFunc) {
        let obj = promise[randomKey];
        return () => {
            eventQueue.addQueue(() => {
                innerFunc && innerFunc();
                resultFunc(obj.result);
            });
        };
    }
    ```

## 手写简易Promise（源码）

- eventQueue.js
    ```
    const queue = [];
    
    function runQueue() {
        while (queue.length > 0) {
            let func = queue.shift();
            func && func();
        }
        setTimeout(runQueue,1)
    }
    
    function addQueue(func) {
        queue.push(func);
    }
    
    module.exports = {
        addQueue:addQueue,
        runQueue:runQueue,
    }
    ```
    
- MyPromise.js
    ```
    const eventQueue = require("./eventQueue");
    const STATE_FULFILLED = "fulfilled";
    const STATE_REJECTED = "rejected";
    const randomKey = Math.random().toString(16).substr(2);
    
    eventQueue.runQueue();
    
    /**
     * 创建观察者
     * 1. innerFunc的执行需要放到事件队列中
     */
    function createWatcher(promise, resolve, reject, innerFunc) {
        let obj = promise[randomKey];
        return () => {
            eventQueue.addQueue(() => {
                handleInnerFuncRes(resolve, reject, innerFunc, obj.result);
            });
        };
    }
    
    function createFinallyWatcher(promise, resultFunc, innerFunc) {
        let obj = promise[randomKey];
        return () => {
            eventQueue.addQueue(() => {
                innerFunc && innerFunc();
                resultFunc(obj.result);
            });
        };
    }
    
    /**
     * 执行内部函数
     * 1.内部函数需要返回一个新的Promise对象
     */
    function runInnerFunc(promise, onFulfill, onRejected) {
        let obj = promise[randomKey];
        return new MyPromise((resolve, reject) => {
            obj.resolveWatcher.push(createWatcher(promise, resolve, reject, onFulfill));
            obj.rejectedWatcher.push(createWatcher(promise, resolve, reject, onRejected));
            obj.tryFinish();
        });
    }
    
    function runInnerFinallyFunc(promise, innerFunc) {
        let obj = promise[randomKey];
        return new MyPromise((resolve, reject) => {
            obj.resolveWatcher.push(createFinallyWatcher(promise,resolve,innerFunc));
            obj.rejectedWatcher.push(createFinallyWatcher(promise,reject,innerFunc));
            obj.tryFinish();
        });
    }
    
    /**
     * 处理内部函数的执行结果
     * 1.内部函数执行结果为Promise时，需要等待Promise执行结果
     */
    function handleInnerFuncRes(resolve, reject, innerFunc, result) {
        let res = innerFunc && innerFunc(result);
        if (res && res instanceof MyPromise) {
            res.then(
                (v) => {
                    resolve(v);
                },
                (v) => {
                    reject(v);
                });
        } else {
            resolve(res);
        }
    }
    
    function MyPromise(executor) {
        const obj = {
            result: null,
            state: null,
            resolveWatcher: [],
            rejectedWatcher: [],
            tryFinish: function () {
                let watchers = [];
                if (this.state === STATE_FULFILLED) {
                    watchers = this.resolveWatcher;
                } else if (this.state === STATE_REJECTED) {
                    watchers = this.rejectedWatcher;
                }
                while (watchers.length > 0) {
                    let watcher = watchers.shift();
                    watcher(this.result);
                }
            }
        };
        this[randomKey] = obj;
        executor(
            (v) => {
                if (obj.state === null) {
                    obj.state = STATE_FULFILLED;
                    obj.result = v;
                    obj.tryFinish();
                }
            },
            (v) => {
                if (obj.state === null) {
                    obj.state = STATE_REJECTED;
                    obj.result = v;
                    obj.tryFinish();
                }
            },
        );
    
        this.then = function (onFulfil, onRejected) {
            return runInnerFunc(this, onFulfil, onRejected);
        };
    
        this.catch = function (onRejected) {
            return runInnerFunc(this, null, onRejected);
        };
    
        this.finally = function (func) {
            return runInnerFinallyFunc(this, func);
        };
    }
    
    MyPromise.resolve = function (v) {
        return new MyPromise(function (resolve, reject) {
            resolve(v);
        });
    };
    MyPromise.reject = function (v) {
        return new MyPromise(function (resolve, reject) {
            reject(v);
        });
    };
    
    module.exports = MyPromise;
    ```