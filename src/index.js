// require('dotenv').config()
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";


dotenv.config({
    path: "./env"
});

connectDB()
.then(app.listen(process.env.PORT,()=>{
    console.log(`App is running at port ${process.env.PORT}`)
}))
.catch((err)=>{
    console.log("Mongodb connection failed !!! ",err)
})



















/*
 Just for demo purpose
( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}`);
        console.log("DB Connected");
        app.on("error", (err) => {
            console.error("ERROR: ", error)
            throw error
        })
        app.listen(process.env.PORT, () => {
            console.log(`Listening on PORT: ${process.env.PORT}`);
        })
    } catch (error) {
        console.error("ERROR: ", error)
        throw error
    }
})()
*/