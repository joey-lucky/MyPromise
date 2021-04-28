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
        obj.resolveWatcher.push(createFinallyWatcher(promise, resolve, innerFunc));
        obj.rejectedWatcher.push(createFinallyWatcher(promise, reject, innerFunc));
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
        res.then((value) => {
            resolve(value);
        }, (reason) => {
            reject(reason);
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