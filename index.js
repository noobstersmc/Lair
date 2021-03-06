//Pull enviromental variables
require("dotenv").config();
//Dependencies
const express = require("express");
//Require express
const app = express();
//Mongo for auth
const mongo = require("./src/databases/mongo");
//Import routes
const instances = require("./routes/instances");
const bills = require("./routes/bills");
const utils = require("./routes/utilities");
const guis = require("./routes/guis");

//Initialize middleware
app.use(require("./middleware/logger"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//Initialize routes
app.use("/instances", instances);
app.use("/billing", bills);
app.use("/utils", utils);
app.use("/guis", guis);

//Start Lair
let PORT = process.env.PORT || 80; //process.env.PORT || 420;
app.listen(PORT, () => console.log(`Lair has started in port ${PORT}`));

//Authentication function
async function authentication(req, res) {
  let user_token = req.headers.authorization;
  //Verify input
  if (!user_token) {
    res.status(400).json({ error: "Authorization token is missing." });
    return false;
  }
  //Query mongo for auth
  let token = await mongo.client
    .db("condor")
    .collection("auth")
    .findOne({ token: user_token });
  if (!token) {
    res.status(401).json({ error: "Authorization token can't be validated." });
    return false;
  }
  //return true if valid
  return true;
}

exports.authentication = authentication;
exports.mongo = mongo;

//TODO: IMPLEMENT MISSING PATHS, BILLING AND USE AUTH TOKEN AS BILLING ID.
