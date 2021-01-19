const router = require("express").Router();
const seeds = require("../logic/seeds");

router.get("/seed", (req, res) => {
  res.send(seeds.getRandomSeed());
});

module.exports = router;
