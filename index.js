const { urlencoded } = require("express");
const express = require("express");
const path = require("path");
const app = express();

const PORT = 8080;
//Json model of the server status
var status = {
  provider: "vultr",
  status: "installing graal",
};
//Json Data model for the data. Subject to change.
var uhc_data = {
  host: "aleiv",
};
//Body parse middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
//Returns the status of the instance as a whole
app.get("/api/server/status", (req, res) => {
  res.json(status);
});
//Return the data, if there is any, of the UHC
app.get("/api/server/uhc", (req, res) => {
  res.json(uhc_data);
});
//Should allow for data to be written.
app.post("/", (req, res) => {
  res.send(req.body);
  console.log("Request post");
});
//Starts the app
app.listen(PORT, () => console.log(`Condor landed in port ${PORT}`));
