const eventQueue = require("./eventQueue");
const STATE_FULFILLED = "fulfilled";
const STATE_REJECTED = "rejected";
const PROMISE_ID = Math.random().toString(36).substr(2); // 用于标识是否初始化，是否为MyPromise对象

eventQueue.runQueue();

let id = 1;
function nextId() {
    return ++id;
}

/**
 * 创建观察者
 * 1. innerFunc的执行需要放到事件队列中
 */
function createWatcher(promise, resolve, reject, innerFunc) {
    return () => {
        eventQueue.addQueue(() => {
            handleInnerFuncRes(resolve, reject, innerFunc, promise);
        });
    };
}

/**
 * 执行内部函数
 * 1.内部函数需要返回一个新的Promise对象
 */
function handleThen(promise, onFulfill, onRejected) {
    return new MyPromise((resolve, reject) => {
        promise._resolveWatcher.push(createWatcher(promise, resolve, reject, onFulfill));
        promise._rejectedWatcher.push(createWatcher(promise, resolve, reject, onRejected));
        promise._tryFinish();
    });
}

/**
 * 处理内部函数的执行结果
 * 1.内部函数执行结果为Promise时，需要等待Promise执行结果
 */
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

function resolve(promise, value) {
    if (promise._state == null) {
        promise._state = STATE_FULFILLED;
        promise._result = value;
        promise._tryFinish();
    }
}

function reject(promise, reason) {
    if (promise._state == null) {
        promise._state = STATE_REJECTED;
        promise._result = reason;
        promise._tryFinish();
    }
}

/**
 * 初始化promise
 */
function makePromise(promise) {
    if (!promise[PROMISE_ID]) {
        promise[PROMISE_ID] = nextId();
        promise._resolveWatcher = [];
        promise._rejectedWatcher = [];
        promise._state = null;
        promise._result = null;
        promise._tryFinish = () => {
            let watchers = [];
            if (promise._state === STATE_FULFILLED) {
                watchers = promise._resolveWatcher;
            } else if (promise._state === STATE_REJECTED) {
                watchers = promise._rejectedWatcher;
            }
            while (watchers.length > 0) {
                let watcher = watchers.shift();
                watcher(promise._result);
            }
        };
    }
}

function MyPromise(executor) {
    let promise = this;
    makePromise(this);
    executor(function (value) {
        resolve(promise, value);
    }, function (reason) {
        reject(promise, reason);
    },);

    this.then = function (onFulfil, onRejected) {
        return handleThen(promise, onFulfil, onRejected);
    };

    this.catch = function (onRejected) {
        return this.then(null, onRejected);
    };

    this.finally = function (callback) {
        return this.then((v) => {
            callback && callback();
            return v;
        }, (reason) => {
            callback && callback();
            return MyPromise.reject(reason);
        });
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