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