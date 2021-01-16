const router = require("express").Router();
const lair = require("../index");
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
  //TODO: Handle instance creation with cloud provider
  let instances = lair.mongo.client.db("condor").collection("instances");
  let result = await instances.insertOne({
    game_id: uuidv4(),
    request: creation_json,
    creation: {
      time: Date.now(),
      creator: creation_json.host_uuid,
    },
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
  //Find and update document
  let instance = await lair.mongo.client
    .db("condor")
    .collection("instances")
    .findOneAndUpdate(
      { game_id: id },
      { $set: update_json },
      { returnOriginal: false }
    );
  if (!instance.value) {
    res.status(404).json({ error: "Instance could not be found." });
    return;
  }
  res.json(instance.value);
});

//Export routes
module.exports = router;
