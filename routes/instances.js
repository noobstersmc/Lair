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
    instance: createServerRequest.instance,
  });
  console.log(result.ops[0]);

  //Respond
  res.status(200).json(result.ops[0]);
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
  }
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
  //Return delete response.
  res.json(await driver.deleteServer(null, null, id));
  //TODO: Save to database however many hours were consumed.
});

//Export routes
module.exports = router;
