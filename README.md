[toc]
# 震惊，实现Promise竟然只需要一分钟，史上最简单的Promise源码教学

## 一、概念

- Fulfilled-Promise，被完成的Promise对象
- Rejected-Promise，被拒绝的Promise对象

## 二、Promise的特点

### 2.1 then/catch/finally都会返回一个新的Promise对象

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

### 2.2 即使then/catch内部函数返回Promise对象，then/catch仍然是返回新对象，与内部函数返回的Promise有相同的执行结果

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

### 2.3 如果onFulfilled/onRejcted返回值是Rejected-Promise，则then/catch也将会返回新的Rejected-Promise对象
```
Promise.resolve()
    .then(()=>Promise.reject(1))
    .catch((v)=>console.log(v)) // 调用了catch，打印1
```

### 2.4 finally无法修改Promise状态
```
// 
Promise.resolve(1)
    .finally(() => 2)
    .then((v) => {
        console.log(v)  // 打印1
    });
```

### 2.5 可以多次调用then/catch/finally方法

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

### 2.6 promise按事件队列进行执行

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

## 三、实现难点

### 3.1 构建事件队列

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

### 3.2 then/catch/finally内部函数的处理

- 内部函数处理时，需要返回一个新的Promise对象
    ```
    function handleThen(promise, onFulfill, onRejected) {
        return new MyPromise((resolve, reject) => {
            promise._resolveWatcher.push(createWatcher(promise, resolve, reject, onFulfill));
            promise._rejectedWatcher.push(createWatcher(promise, resolve, reject, onRejected));
            promise._tryFinish();
        });
    }
    ```
- 内部函数执行时，需要通过事件队列
    ```
    function createWatcher(promise, resolve, reject, innerFunc) {
        return () => {
            eventQueue.addQueue(() => {
                handleInnerFuncRes(resolve, reject, innerFunc, promise);
            });
        };
    }
    ```
    > eventQueue 是上面封装的事件队列

- 内部函数执行结果，如果返回Promise的处理
    ```
    function handleInnerFuncRes(resolve, reject, innerFunc, promise) {
        let res = innerFunc && innerFunc(promise._result);
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
    this.finally = function (callback) {
        return this.then((v) => {
            callback && callback();
            return v;
        }, (reason) => {
            callback && callback();
            return MyPromise.reject(reason);
        });
    };
    ```
    > 通过then实现

> 源码：[https://github.com/joey-lucky/MyPromise](https://github.com/joey-lucky/MyPromise)
