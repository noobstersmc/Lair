const router = require("express").Router();
const redis = require("../src/databases/redis");
const seeds = require("../logic/seeds");
const twitter = require("../logic/twitter");
const lair = require("../index");

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
