import "dotenv/config";
import connectdb from "./db/index.js";
import {app} from './app.js';


console.log(process.env.MONGODB_URL);

connectdb()
.then(()=>{
    app.on("err",(err)=>{
        console.log("ERR:",err);
        throw err;
    })
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`server is running at port:${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log("mongodb connection error!!!",err);
})