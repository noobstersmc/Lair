const router = require("express").Router();
const e = require("express");
const lair = require("../index");

//All routes here should be authenticated.
router.use((req, res, next) => {
  lair
    .authentication(req, res)
    .then((result) => {
      if (result === true) {
        next();
      } else return;
    })
    .catch((error) => {
      res.status(400).json({ error });
      return;
    });
});

router.get("/:id", async (req, res) => {
  let id = req.params.id;
  if (!id || id.length < 2) {
    res.status(400).json({ error: "No billing id provided" });
    return;
  }
  var options = { token: id };

  if (req.query && req.query.onlyActive)
    options.deletion = { $exists: req.query.onlyActive !== "true" };

  console.log(options);

  let bills_collection = lair.mongo.client.db("condor").collection("instances");
  let cursor = await bills_collection.find(options);
  if ((await cursor.count()) === 0) {
    res.status(404).json({ error: "No instances found." });
  } else {
    res.json(await cursor.toArray());
  }
});
router.get("/", async (req, res) => {
  let bills_collection = lair.mongo.client.db("condor").collection("instances");

  var options = {};

  if (req.query && req.query.onlyActive)
    options.deletion = { $exists: req.query.onlyActive !== "true" };

  console.log(options);
  let cursor = await bills_collection.find(options);
  if ((await cursor.count()) === 0) {
    res.status(404).json({ error: "No instances found." });
  } else {
    res.json(await cursor.toArray());
  }
});
module.exports = router;
