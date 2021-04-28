const MyPromise = require("./MyPromise");
const Promise = MyPromise;

Promise.resolve().then(() => {
    console.log("1-1");
}).then(() => {
    console.log("1-2")
});
Promise.resolve().then(()=>{
    console.log("2-1");
    return Promise.resolve();
}).then(()=>{
    console.log("2-2");
    return new Promise((resolve)=>setTimeout(resolve,1000))
}).then(()=>{
    console.log("2-3")
});
Promise.resolve().then(()=>{
    console.log("3-1");
}).then(()=>{
    console.log("3-2")
});

Promise.resolve(1)
    .then(v=>v+1)
    .then(v=>Promise.reject(v+1))
    .finally()
    .catch((v)=>console.log("catch",v));