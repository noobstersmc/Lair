const { MongoClient } = require("mongodb");
const MUUID = require("uuid-mongodb");
const uri =
  "mongodb+srv://admin:Henixceo1!@cluster0.tpjaz.mongodb.net/admin?autoReconnect=true?retryWrites=true&w=majority";
const client = new MongoClient(uri);

var database;
var collection;

async function run() {
  await client.connect();
  database = client.db("condor");
  collection = database.collection("invoices");
}
run();

exports.client = client;
exports.collection = collection;
exports.database = database;
