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