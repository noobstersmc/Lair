const router = require("express").Router();
const lair = require("../index");
const redis = require("../src/databases/redis");
const driver = require("../src/VultrDriver");
const { v4: uuidv4 } = require("uuid");

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
//List all running instances
router.get("/", async (req, res) => {
  let r = await lair.mongo.client
    .db("condor")
    .collection("instances")
    .find()
    .toArray();
  res.send(r);
});
//Create instance
router.post("/", async (req, res) => {
  //Create an instance and post it to the database.
  var creation_json = req.body;
  //Validate the json sent.
  try {
    JSON.parse(JSON.stringify(req.body));
  } catch (e) {
    //Catch JSON format exception.
    console.log(e);
    res.status(400).json({ error: "Invalid JSON." });
    return;
  }

  let instance_provider = creation_json.instance_type;
  if (!instance_provider) {
    res.status(400).json({ error: "Provider not specified." });
    return;
  }
  let game_config = creation_json.config;
  if (!game_config || !game_config.game_type) {
    res.status(400).json({ error: "Game type not specified." });
    return;
  }
  //Keep track of everything here
  let amounts = { outstanding_credits: 0, active: 0 };
  //Obtain active instances
  let active_instances = await lair.mongo.client
    .db("condor")
    .collection("instances")
    .find({ token: req.headers.authorization, deletion: { $exists: false } });
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
    .findOne({ token: req.headers.authorization });
  //JSON limits
  let limit = {
    instance_limit: parseInt(limitQuery.instance_limit),
    credits: parseFloat(limitQuery.credits),
  };
  //Validate limit
  if (limit.instance_limit != -1 && amounts.active >= limit.instance_limit) {
    res.status(401).json({ error: "Instance limit reached", limit, amounts });
    return;
  }
  //Check if balance there's balance in the account
  let credits_left = limit.credits - amounts.outstanding_credits;
  if (limit.credits !== -420.0 && credits_left <= 0.2) {
    res
      .status(401)
      .json({ error: "Not enough credits.", credits_left, limit, amounts });
    return;
  }
  //TODO: Improve the way redis manages the data
  let condor_id = uuidv4();
  redis.set(
    `data:${condor_id}`,
    JSON.stringify({
      host_uuid: creation_json.host_uuid,
      host: creation_json.host ? creation_json.host : "Condor Game",
      extra_data: {
        level_seed: `${
          game_config.level_seed ? game_config.level_seed : "random"
        }`,
        team_size: game_config.team_size ? game_config.team_size : 1,
        scenarios: game_config.scenarios ? game_config.scenarios : [],
      },
      game_type: game_config.game_type,
      private: game_config.private ? game_config.private : false,
      whitelist: game_config.whitelist ? game_config.whitelist : "none",
    })
  );
  //Call the driver for an instance.
  let createServerRequest = await driver.createServer(
    condor_id,
    creation_json.host,
    instance_provider.type ? instance_provider.type : "vhf-2c-4gb",
    game_config.game_type.toLowerCase() === "uhc-run"
      ? "uhc-run"
      : game_config.game_type.toLowerCase()
  );
  //ADD to mongo
  let instances = lair.mongo.client.db("condor").collection("instances");
  let result = await instances.insertOne({
    game_id: condor_id,
    request: creation_json,
    creation: {
      time: Date.now(),
      creator: creation_json.host_uuid,
    },
    token: req.headers.authorization,
    instance: createServerRequest.instance,
  });
  console.log(result.ops[0]);

  //Respond
  res.json(result.ops[0]);
});
//Get specific instance
router.get("/:id", async (req, res) => {
  //Verify input id
  let id = req.params.id;
  if (!id || id.length < 2) {
    res.status(400).json({ error: "No instance id provided" });
    return;
  }
  let instance = await lair.mongo.client
    .db("condor")
    .collection("instances")
    .findOne({ game_id: id });
  if (!instance) {
    res.status(404).json({ error: "Instance doesn't exist" });
    return;
  }
  //Respond
  res.status(200).json(instance);
});
//Delete an instance
router.delete("/:id", async (req, res) => {
  //Verify input id
  let id = req.params.id;
  if (!id || id.length < 2) {
    res.status(400).json({ error: "No instance id provided" });
    return;
  }
  //Update object to mark as deleted on mongo
  let update_json = { deletion: { time: Date.now() } };
  //If a sender is provided, add them to the json
  if (req.query.sender) update_json.deletion.deletor = req.query.sender;

  let collection = await lair.mongo.client.db("condor").collection("instances");
  //Verify it hasn't been deleted before
  let test_instance = await collection.findOne({ game_id: id });

  //Don't keep going if server has already been marked as deleted.
  if (
    test_instance &&
    test_instance.deletion &&
    (!req.query.override || req.query.override !== "true")
  ) {
    res.status(409).json({ error: "Server already marked as deleted." });
    return;
  } else if (!test_instance) {
    res.status(401).json({ error: "No instance found" });
  }
  //Calculate how many credits have been consumed.
  let cost =
    (update_json.deletion.time - test_instance.creation.time) / 3_600_000;
  //Consume credits.
  let profiles = lair.mongo.client.db("condor").collection("auth");
  await profiles.findOneAndUpdate(
    { token: test_instance.token, credits: { $gt: -420 } },
    { $inc: { credits: Math.ceil(cost) * -1 } },
    { upsert: true }
  );

  //Find and update document
  let instance = await collection.findOneAndUpdate(
    { game_id: id },
    { $set: update_json },
    { returnOriginal: false }
  );
  if (!instance.value) {
    res.status(404).json({ error: "Instance could not be found." });
    return;
  }
  if (req.query.fromBukkit) {
    redis.publish(
      "condor",
      JSON.stringify({
        type: "move",
        source: id,
        target: "lobby",
        players: "@a",
      })
    );
  }
  //Return delete response.
  res.json(await driver.deleteServer(null, null, id));
  //TODO: Save to database however many hours were consumed.
});

//Export routes
module.exports = router;
