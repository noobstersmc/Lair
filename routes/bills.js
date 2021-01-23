const router = require("express").Router();
const { func } = require("joi");
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

router.get("/status", async (req, res) => {
  var options = { token: req.headers.authorization };

  if (req.query && req.query.onlyActive)
    options.deletion = { $exists: req.query.onlyActive !== "true" };

  let amounts = { outstanding_credits: 0, active: 0 };
  //Obtain active instances
  let active_instances = await lair.mongo.client
    .db("condor")
    .collection("instances")
    .find({ token: options.token, deletion: { $exists: false } });
  //Pass it to an array
  let collection = await active_instances.toArray();
  if (collection.length > 0) {
    //Add the amount of currently active instances.
    amounts.active = collection.length;
    //Iterate to find the uptime of each instance
    collection.forEach((instances) => {
      let outstanding_credits = Math.ceil(
        (Date.now() - parseInt(instances.creation.time)) / 3_600_000
      );
      //Increment the amount of outstanding credits.
      amounts.outstanding_credits += outstanding_credits;
    });
  }
  //Query the user's limit
  let limitQuery = await lair.mongo.client
    .db("condor")
    .collection("auth")
    .findOne({ token: req.headers.authorization });
  //JSON limits
  let limit = {
    instance_limit: parseInt(limitQuery.instance_limit),
    credits: parseFloat(limitQuery.credits),
  };

  let bills_collection = lair.mongo.client.db("condor").collection("instances");
  let cursor = await bills_collection.find(options);

  res.json({ amounts, limit, instances: await cursor.toArray() });
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
