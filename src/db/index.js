import mongoose from "mongoose";
import {DB_name} from "../constants.js";

const connectdb=async ()=>{
    try{
        const connectionInstance= await mongoose.connect(`${process.env.MONGODB_URL}/${DB_name}`);
        console.log(`\n Mongodb connected !! DB_host:${connectionInstance.connection.host}`);
    } 
    catch(error){
        console.log("Mongodb connection failed",error);
        process.exit(1);
    }
} 
export default connectdb;