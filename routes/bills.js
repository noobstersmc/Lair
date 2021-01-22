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

  let amounts = { outstanding_credits: 0, active: 0 };
  //Obtain active instances
  let active_instances = await lair.mongo.client
    .db("condor")
    .collection("instances")
    .find({ token: id, deletion: { $exists: false } });
  //Pass it to an array
  let collection = await active_instances.toArray();
  if (collection.length > 0) {
    //Add the amount of currently active instances.
    amounts.active = collection.length;
    //Iterate to find the uptime of each instance
    collection.forEach((instances) => {
      let outstanding_credits = Date.now() - parseInt(instances.creation.time);
      //Increment the amount of outstanding credits.
      amounts.outstanding_credits += outstanding_credits;
    });
  }
  //Set to 5 decimal point partial hours.
  amounts.outstanding_credits = parseFloat(
    (amounts.outstanding_credits / 3_600_000).toFixed(4)
  );
  //Query the user's limit
  let limitQuery = await lair.mongo.client
    .db("condor")
    .collection("auth")
    .findOne({ token: id });
  //JSON limits
  let limit = {
    instance_limit: parseInt(limitQuery.instance_limit),
    credits: parseFloat(limitQuery.credits),
  };

  let bills_collection = lair.mongo.client.db("condor").collection("instances");
  let cursor = await bills_collection.find(options);
  if ((await cursor.count()) === 0) {
    res.status(404).json({ error: "No instances found." });
  } else {
    res.json({ amounts, limit, instances: await cursor.toArray() });
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
