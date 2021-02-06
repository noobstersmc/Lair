const router = require("express").Router();
const redis = require("../src/databases/redis");
const seeds = require("../logic/seeds");
const twitter = require("../logic/twitter");
const lair = require("../index");

router.post("/create-token", async (req, res) => {
  if (!(await lair.authentication(req, res))) return;
  let request_json = req.body;
  let json = {
    token: request_json.token,
    name: request_json.name,
    credits: parseFloat(request_json.credits),
    instance_limit: parseInt(request_json.limit),
  };

  await lair.mongo.client
    .db("condor")
    .collection("auth")
    .findOneAndUpdate(
      { token: request_json.token },
      { $set: json },
      { upsert: true }
    );
  res.json({ result: "ok" });
});
router.post("/data", async (req, res) => {
  let body = req.body;
  if (body) {
    redis.set(`${body.key}`, JSON.stringify(body.value));
    res.json({ result: "Ok" });
  } else {
    res.json({ error: "No data provided" });
  }
});

router.get("/seeds", (req, res) => {
  res.send(seeds.getRandomSeed());
});

router.post("/tweet", async (req, res) => {
  //TODO: Not safe, make a per token permission system.
  if (!(await lair.authentication(req, res))) return;

  var text = req.body.tweet;
  if (text) {
    twitter
      .tweet(text)
      .then((tweet_response) => {
        let user = tweet_response.user.screen_name;
        let tweet_id = tweet_response.id_str;
        let url_response = `https://twitter.com/${user}/status/${tweet_id}`;
        res.send({ response: 200, url: url_response });
      })
      .catch((tweet_error) => {
        res.send(tweet_error[0]);
      });
  } else {
    res.send({ error: 6901, message: "No text was provided." });
  }
});

router.post("/message", async (req, res) => {
  let result = redis.publish(
    `${req.body.channel}`,
    JSON.stringify(req.body.message)
  );
  res.json({ result: "ok" });
});

let map = new Map();
router.post("/request", async (req, res) => {
  let template = makeid(6);
  map.set(template, req.body);
  res.send(template);
});
router.get("/request", async (req, res) => {
  let config = map.get(req.query.template_id);
  if (!config) {
    res.send("error");
  } else {
    map.delete(req.query.template_id);
    res.send(config);
  }
});

function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

router.get("/game", async (req, res) => {
  if (!(await lair.authentication(req, res))) return;

  redis.get(`data:${req.query.condor_id}`, (err, reply) => {
    if (err) {
      console.error(err);
      res.send({
        error: err,
      });
    } else {
      if (reply == null) {
        res.send({ error: "No data" });
      } else {
        res.send(JSON.parse(reply));
      }
    }
  });
});

module.exports = router;
