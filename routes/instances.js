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
    res.status(401).json({ error: "Instance limit reached.", limit, amounts });
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
  if (req.headers.authorization === "vandal") {
    game_config.whitelist =
      "https://hynix-resources.s3.amazonaws.com/whitelist/whitelist.json";
  }
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
    limitQuery.name,
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
  //Verify authority of token.
  let token = req.headers.authorization;

  let instances = lair.mongo.client.db("condor").collection("instances");
  let profiles_collection = lair.mongo.client.db("condor").collection("auth");

  profiles_collection
    .findOne({ token })
    .then((doc) => {
      if (doc) {
        let profile = doc;
        let notSuperToken = !profile.super_token;
        //Update object to mark as deleted on mongo
        let update_json = { deletion: { time: Date.now() } };
        //If a sender is provided, add them to the json
        if (req.query.sender) update_json.deletion.deletor = req.query.sender;
        //Look for the instance
        let query = { game_id: id, deletion: { $exists: false } };
        //Send the request token if not a super user.
        if (notSuperToken) query.token = token;
        let update = { $set: update_json };
        let options = { returnOriginal: false };
        //Perform querry
        instances.findOneAndUpdate(query, update, options, function (err, ins) {
          if (err) console.log(err);
          else if (!ins.value) {
            res
              .status(404)
              .json({ error: "Server not found or already deleted." });
          } else {
            //If server found, user is authorized to interact with the instance.
            let instance = ins.value;
            let hours =
              (update_json.deletion.time - instance.creation.time) / 3_600_000;
            //Consume the negative eq
            let cost = -Math.ceil(hours);
            //Find and update the owner of the instance being deleted.
            // $ne: -420 ensures unlimited are not consumed.
            profiles_collection
              .findOneAndUpdate(
                { token: instance.token, credits: { $ne: -420 } },
                { $inc: { credits: cost } }
              )
              .then((final_result) => {
                console.log(`Updated: ${JSON.stringify(final_result)}`);
                res.json({ result: "ok", final_result });
              })
              .catch((final_catch) => {
                console.error(final_catch);
                res.json({ final_catch });
              });
            //Tell condor-velocity to move all players @ server to lobby.
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
            driver.deleteServer(null, null, id).then((result) => {
              console.log({ deleteResult: result });
            });
          }
        });
      } else {
        res.status(401).json({ error: "Unauthorized." });
      }
    })
    .catch((err) => {
      if (err) {
        console.error(err);
        res.json({ error: err });
      } else {
        res.json({ error: "No error" });
      }
    });
});

//Export routes
module.exports = router;
