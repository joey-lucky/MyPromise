[toc]
# Promise源码教学

源码实现三部曲
1. 了解api
2. 分析难点
3. 实现源码


## 一、了解APi

Promise用于创建异步任务，任务的执行结果分成成功和失败
- Fulfilled-Promise，执行成功的Promise对象
- Rejected-Promise，执行失败的Promise对象

### 1.1 then/catch/finally 都会返回一个新的Promise对象

```
// 测试then
let p1 = Promise.resolve();
let p2 = p1.then();
p2.finally(()=>{
    console.log(p1 === p2); //false
});

// 测试catch
let p1 = Promise.reject(1);
let p2 = p1.catch();
p2.finally(()=>{
    console.log(p1 === p2); //false
});

// 测试finally
let p1 = Promise.resolve();
let p2 = p1.finally();
p2.finally(()=>{
    console.log(p1 === p2); //false
});

// 测试回调函数返回Promise对象的情况
let onFulfilledRes = Promise.resolve();
let thenReturn = Promise.resolve()
    .then(() => {
        return onFulfilledRes;
    });
console.log(thenReturn === onFulfilledRes); //false
```

### 1.2 then/catch/finally 可以多次调用

```
// 测试then和finally,catch是一样的
let p = new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve(1)
    }, 1000);
});
p.then((v) => console.log(v)); //1
p.then((v) => console.log(v)); //1
p.finally(() => console.log("finally1")); //finally1
p.finally(() => console.log("finally2")); //finally2
```

### 1.3 执行顺序按照先进先出的原则

> 如果回调函数返回Promise对象，相当于多了一层。

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

## 二、实现难点

### 2.1 构建微任务队列模块

> 队列规则是先进先出，循环执行队列处理，并暴露一个添加任务的函数

```
// 简易的事件队列
const mircoTask = [];

(function runQueue() {
    while (mircoTask.length > 0) {
        let func = mircoTask.shift();
        func && func();
    }
    setTimeout(runQueue,1)
})();

function addMircoTask(func) {
    mircoTask.push(func);
}

module.exports = {
    addMircoTask:addMircoTask
}
```

### 2.2 构建发布订阅模式

```
class MyPromise {
    _resolveSubscriber = [];
    _rejectSubscriber = [];
    _result = null; // 结果
    _state = -1; // 状态，1表示成功 0表示失败 -1表示等待结果

    _finish = () => {
        if (this._state !== -1) { 
            let subscribers = this._state === 0 ? this._rejectSubscriber : this._resolveSubscriber;
            while (subscribers.length > 0) {
                let subscriber = subscribers.shift(); // 遵守先进先出的原则
                subscriber(this._result);
            }
        }
    };
}
```

- 订阅者是then/catch/finally里面的回调函数。

    ```
    promise.then(function 订阅者(){
    
    });
    ```

- 订阅的内容是执行结果，通过_finish通知订阅者

### 2.3 构造函数中的resolve和reject函数

```
class MyPromise {
    constructor(executor) {
        const resolve = (value) => {
            this._state = 1;
            this._result = value;
            this._finish();
        };
        const reject = (err)=>{
            this._state = 0;
            this._result = err;
            this._finish();
        }
        executor(resolve, reject);
    }
}
```

> 调用resolve表示执行成功，reject表示执行失败，除了记录状态和结果外，还要调用_finish，通知订阅。

### 2.4 then的实现（难）

**实现思路如下**

- then调用时，会将回调函数（订阅者）加入到订阅者队列。

    ```
    class MyPromise {
        then = (resolveCallBack,rejectCallBack)=>{
            this._resolveSubscriber.push(resolveCallBack);
            this._rejectSubscriber.push(rejectCallBack);
        }
    }
    ```
- 执行会返回一个新的Promise对象

    ```
    class MyPromise {
        then = (resolveCallback, rejectCallback) => {
            return new MyPromise((resolve,reject)=>{
                this._resolveSubscriber.push(resolveCallBack);
                this._rejectSubscriber.push(rejectCallBack);
            })
        };
    }
    ```

- finish用于响应订阅者，在Promise执行结束后会自动调用，但如果已经结束后，在调用then，需要主动的调用一次finish

    ```
    class MyPromise {
        then = (resolveCallback, rejectCallback) => {
            return new MyPromise((resolve,reject)=>{
                //....
                this._finish();
            })
        };
    }
    ```

  > 不用担心finish函数，因为finish时会判断状态，状态为等待的话，不会执行。

- 回调函数（订阅者）执行是异步的，所以需要将回调函数加入到微任务。

  > 回调函数的返回结果在微任务里面

    ```
    class MyPromise {
        then = (resolveCallback, rejectCallback) => {
            return new MyPromise((resolve,reject)=>{
                const createMircoTask = (callback) => {
                    return () => {
                        mircoTaskQueue.addMircoTask(()=>{
                           callback(this._result);                    
                        });
                    };
                };
                this._resolveSubscriber.push(createMircoTask(resolveCallback));
                this._rejectSubscriber.push(createMircoTask(rejectCallback));
                this._finish();
            })
        };
    }
    ```

- 可以通过回调函数的返回值，来控制新的Promise对象的执行结果

  > 回调函数的返回结果在微任务里面

    ```
    class MyPromise {
        then = (resolveCallback, rejectCallback) => {
            return new MyPromise((resolve,reject)=>{
                const createMircoTask = (callback) => {
                    return () => {
                        mircoTaskQueue.addMircoTask(()=>{
                            let callbackResult = callback(this._result);
                            resolve(callbackResult);                        
                        });
                    };
                };
                // ...
            })
        };
    }
    ```

- 还要兼容回调函数的返回值是Promise对象的情况

    ```
    class MyPromise {
        then = (resolveCallback, rejectCallback) => {
            return new MyPromise((resolve,reject)=>{
                const createMircoTask = (callback) => {
                    return () => {
                        mircoTaskQueue.addMircoTask(()=>{
                            let callbackResult = callback(this._result);
                            if (callbackResult instanceof MyPromise) {
                                callbackResult.then(resolve, reject);
                            }else {
                                resolve(callbackResult);
                            }
                        });
                    };
                };
                // ...
            })
        };
    }
    ```

### 2.4 catch和finally的实现（简单）

```
class MyPromise {
    catch = (rejectCallback) => {
        return this.then(()=>this._result, rejectCallback);
    };

    finally = (callback) => {
        return this.then(() => {
            callback();
            return this._result;
        }, () => {
            callback();
            return this._result;
        });
    };
}
```

> 注意事项，catch执行时，如果Promise执行成功的话，不会调用callback，但是执行结果不变


> 源码：[https://github.com/joey-lucky/MyPromise](https://github.com/joey-lucky/MyPromise)
