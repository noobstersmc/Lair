const { MongoClient } = require("mongodb");
const client = new MongoClient(
  "mongodb+srv://admin:Henixceo1!@cluster0.tpjaz.mongodb.net/admin&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: true,
  }
);

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
