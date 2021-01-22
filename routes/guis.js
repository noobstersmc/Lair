const router = require("express").Router();
const lair = require("../index");
const redis = require("../src/databases/redis");

let map = new Map();

//Obtain all data
router.get("/", async (req, res) => {
  let profiles = await lair.mongo.client
    .db("condor")
    .collection("auth")
    .find()
    .toArray();
  redis.keys("servers:*", function (err, keys) {
    if (err) {
      res.send(err.message);
      return;
    } else {
      redis.mget(keys, function (err2, data) {
        if (err2) {
          res.send(err2);
          return;
        } else {
          let json_info = {};
          data.forEach((server_data) => {
            let j = JSON.parse(server_data);
            json_info[`${j.game_id}`] = j;
          });

          let tokens = {};
          map.forEach((value, key) => {
            tokens[key] = value;
          });
          res.json({ server_data: json_info, profiles, tokens });
        }
      });
    }
  });
});

router.post("/token", async (req, res) => {
  let uuid = req.body.uuid;
  let token = req.body.token;
  map.set(uuid, token);

  let jsonObject = {};
  map.forEach((value, key) => {
    jsonObject[key] = value;
  });

  res.send(JSON.stringify(jsonObject));
});

module.exports = router;
