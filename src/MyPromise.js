const mircoTaskQueue = require("./mircoTaskQueue");

class MyPromise {
    _resolveSubscriber = [];
    _rejectSubscriber = [];
    _result = null; // 结果
    _state = -1; // 状态，1表示成功 0表示失败 -1表示等待结果

    constructor(executor) {
        const resolve = (value) => {
            this._state = 1;
            this._result = value;
            this._finish();
        };
        const reject = (err) => {
            this._state = 0;
            this._result = err;
            this._finish();
        };
        executor(resolve, reject);
    }

    then = (resolveCallback, rejectCallback) => {
        return new MyPromise((resolve, reject) => {
            const createMircoTask = (callback) => {
                return () => {
                    mircoTaskQueue.addMircoTask(() => {
                        let callbackResult = callback && callback(this._result);
                        if (callbackResult instanceof MyPromise) {
                            callbackResult.then(resolve, reject);
                        } else {
                            resolve(callbackResult);
                        }
                    });
                };
            };
            this._resolveSubscriber.push(createMircoTask(resolveCallback));
            this._rejectSubscriber.push(createMircoTask(rejectCallback));
            this._finish();
        });
    };

    catch = (rejectCallback) => {
        return this.then(null, rejectCallback);
    };

    finally = (callback) => {
        return this.then(() => {
            callback && callback();
            return this._result;
        }, () => {
            callback && callback();
            return this._result;
        });
    };

    _finish = () => {
        if (this._state !== -1) {
            let subscribers = this._state === 0 ? this._rejectSubscriber : this._resolveSubscriber;
            while (subscribers.length > 0) {
                let subscriber = subscribers.shift(); // 遵守先进先出
                subscriber(this._result);
            }
        }
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