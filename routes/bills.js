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
  let bills_collection = lair.mongo.client.db("condor").collection("instances");
  let cursor = await bills_collection.find({ "request.billing_id": id });
  if ((await cursor.count()) === 0) {
    res.status(404).json({ error: "No instances found." });
  } else {
    res.json(await cursor.toArray());
  }
});
module.exports = router;
