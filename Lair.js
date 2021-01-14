const { urlencoded } = require("express");
const express = require("express");
const path = require("path");
const app = express();
const requestify = require("requestify");
const seeds = require("./logic/seeds");
const VULTR_API = process.env.VULTR_API || "";
const port = process.env.PORT || 420;
//Vultr Api
const VultrNode = require("@vultr/vultr-node");
const vultr = VultrNode.initialize({
  apiKey: VULTR_API,
});
1;

const redis = require("./logic/redis");
const twitterApi = require("./logic/twitter");
const mongo = require("./logic/mongo");
const games = require("./logic/games");
const logger = require("./middleware/logger");
//const { reset } = require("nodemon");
const MUUID = require("uuid-mongodb");

//Body parse middleware
app.use(logger);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/game", games);
//Should allow for data to be written.
app.post("/create-server", (req, res) => {
  if (authorized(req, res)) {
    console.log(req.body);
    create_server(req, res);
  }
});
app.delete("/instance", (req, res) => {
  if (authorized(req, res)) {
    console.log("");
  }
});
/*Inventory sync for UHC starts*/
app.get("/inventories/:uuid", (req, res) => {
  const uuid = req.params.uuid;
  redis.redisConnection.get(`players:inventory:${uuid}`, (err, reply) => {
    if (err) {
      console.error(err);
      res.send({
        error: err,
      });
    } else {
      if (reply == null) {
        res.send({ error: "No data" });
      } else {
        res.json({ uuid, data: JSON.parse(reply) });
      }
    }
  });
});
app.post("/inventories/:uuid", (req, res) => {
  try {
    const uuid = req.params.uuid;
    let json = req.body;

    json.creation_time = Date.now();
    redis.redisConnection.set(
      `players:inventory:${uuid}`,
      JSON.stringify(json),
      (err, reply) => {
        if (err) {
          console.log(err);
          res.json({ uuid, err });
        } else {
          console.log(reply);
          res.json({ uuid, reply });
        }
      }
    );
  } catch (error) {
    console.log(error);
  }
});

/* ENDS */

app.get("/game", (req, res) => {
  if (authorized(req, res)) {
    redis.redisConnection.get(`data:${req.headers.condor_id}`, (err, reply) => {
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
  }
});
app.post("/tweet", (req, res) => {
  if (authorized(req, res)) {
    var text = req.body.tweet;
    if (text) {
      twitterApi
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
  }
});
app.get("/vultr/sizes", (req, res) => {
  console.log("Processing request of vultr sizes...");
  get_sizes().then((result) => {
    res.send(result);
    console.log("Done.");
  });
});
app.get("/vultr/locations", (req, res) => {
  console.log("Recieved request of locations list");
  vultr.regions.list().then((result) => {
    res.send(result);
    console.log("Done.");
  });
});
app.get("/vultr/servers", (req, res) => {
  console.log("Recieved request of active server list");
  vultr.server.list().then((result) => {
    res.send(result);
    console.log("Done.");
  });
});
app.get("/seeds", (req, res) => {
  res.send(seeds.getRandomSeed());
});
app.post("/invoice/close", (req, res) => {
  mongo.client
    .db("condor")
    .collection("invoices")
    .updateOne(
      { _id: MUUID.from(req.body.condor_id) },
      {
        $set: {
          destroyed_at: Date.now(),
          destroyed_by: req.body.sender,
        },
      },
      { upsert: true }
    )
    .then((result) => {
      mongo.client
        .db("condor")
        .collection("invoices")
        .findOne({ _id: MUUID.from(req.body.condor_id) })
        .then((updated) => {
          res.send({ time: updated.destroyed_at - updated.created_at });
        });
    })
    .catch((err) => {
      res.send({ error: err });
    });
});

let vultr_api_url = "https://api.vultr.com/v2/";
app.get("/vultr/servers/v2", (req, res) =>
  process_get_cv_cmd(req.query.ip, res)
);
//

function process_get_cv_cmd(ip, res) {
  console.log("Recieved request of active server list");
  //Call to the vultr v2 api rest
  let input = ip;
  console.log(input);
  if (input == null) {
    res.sendStatus(400);
  }

  requestify
    .request(`${vultr_api_url}instances`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${VULTR_API}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: {},
      dataType: "json",
    })
    .then((result) => {
      let response_body = result.getBody();
      let total_instances = parseInt(response_body.meta.total);
      let instances = response_body.instances;

      let cosos = {
        total: total_instances,
        instances: instances,
      };

      console.log(cosos);

      let response = {
        from_ip: "",
        id: "",
        command: "",
      };

      instances.forEach((instance) => {
        if (instance.main_ip == input) {
          response.from_ip = instance.main_ip;
          response.id = instance.id;
          response.command = `cv add ${instance.id} ${instance.main_ip} 25565`;

          console.log("ID Found");

          res.send(response);
          return;
        }
      });

      res.sendStatus(404);
    });
}

//Starts the app
app.listen(port, () => console.log(`Condor landed in port ${port}`));
//Async function to get vultr available sizes
async function get_sizes() {
  var promise = vultr.plans.list();
  let result = await promise;
  return result;
}
//Actually create the server function
async function create_server(request, response) {
  //Validate the instance settings.
  let instance_input = verify_instance_input(
    request.body.instance_type,
    request.body.game_type
  );
  //Check if available for deployment.
  let available = await verify_availability(instance_input);
  //If not avaialable, send error.
  if (!available) {
    response.send({
      error: "not available",
      data: instance_input,
    });
    return;
  }

  var condor_id = createUniqueGameNumber();

  if (
    request.body.extra_data.level_seed === undefined ||
    request.body.extra_data.level_seed === "random"
  ) {
    request.body.extra_data.level_seed = seeds.getRandomSeed();
  }

  response.send({ condor_id });
  //RUN SCRIPT 764624
  //NORMAL SCRIPT 764591
  let creation_promise = vultr.server.create(
    create_vultr_json(
      request.body.host,
      `condor-id=${condor_id}\nlevel-seed=${request.body.extra_data.level_seed}\n`,
      get_install_script(request.body.game_type),
      instance_input.plan_id,
      instance_input.region_id
    )
  );
  //Await the promise
  let creation = await creation_promise;
  //Parse the instance SUBID from vultr to an Int.
  let id = parseInt(creation.SUBID);
  console.log(`Vultr created SUBID: ${id}`);
  /* Add logic to track the instances */
  let json = {
    _id: MUUID.from(condor_id),
    created_at: Date.now(),
    created_by: request.body.host_uuid,
    request: request.body,
  };
  mongo.client.db("condor").collection("invoices").insertOne(json);

  console.log(
    `Created server for ${request.body.host} of type ${request.body.game_type} and id ${condor_id}`
  );
}

function get_install_script(game_type) {
  if (game_type === "UHC") {
    return 764591;
  } else if (game_type === "UHC-Run") {
    return 764624;
  } else {
    //ADD MORE CASES LIKE MEETUP
    return 764624;
  }
}

async function verify_availability(response) {
  var promise = vultr.regions.availability({ DCID: response.region_id });
  var result = await promise;
  return result.includes(response.plan_id);
}
//Obtain valid instance information
function verify_instance_input(instance_type, game_type) {
  if (instance_type.provider == "vultr") {
    var response = {};
    //Obtain a plan id understandable by vultr api
    response.plan_id = plan_id_from_description(instance_type.plan);
    if (response.plan_id == undefined) {
      response.plan_id = game_type == "UHC" ? 403 : 402;
      console.log(
        `Plan_id ${instance_type.plan} is undefined, using ${response.plan_id}`
      );
    }
    //Obtain a region ID understandable by vultr api
    response.region_id = region_id_from_name(instance_type.region);
    if (response.region_id == undefined) {
      response.region_id = 1;
      console.log(`Region is undefined, using ${response.region_id}`);
    }
    //Auto change to the only available instance in frnace
    if (response.region_id == 24) {
      //If it is UHC use 8GB is run 4gb
      response.plan_id = game_type == "UHC" ? 204 : 203;
    }
    let id = response.plan_id;
    //Get the resources
    if (id == 203 || id == 402) {
      response.ram = 4000;
      response.disk = id == 203 ? 80000 : 128000;
    } else if (id == 204 || id == 403) {
      response.ram = 8000;
      response.disk = id == 204 ? 55000 : 256000;
    }
    return response;
  }
}
//Obtain plan id from description
function region_id_from_name(region) {
  switch (region.toLowerCase()) {
    case "nyc":
    case "nj":
    case "ewr":
    case "us":
      return 1;
    case "tx":
    case "dfw":
      return 3;
    case "fr":
    case "cdg":
    case "eu":
      return 24;
    default:
      return 1;
  }
}
//Obtain plan id from description
function plan_id_from_description(plan) {
  if (plan == "3c8gb") {
    return 403;
  }
  if (plan == "2c4gb") {
    return 402;
  }
  return undefined;
}
//Auth function
function authorized(request, respone) {
  if (request.headers.auth != "Condor-Secreto") {
    respone.status(401);
    respone.send({
      error: "unauthorized",
    });
    return false;
  }
  return true;
}
async function obtain_ip_from_subid(id) {
  var promise = vultr.server.list({
    SUBID: id,
  });
  let result = await promise;
  let coso = result.main_ip;
  return coso;
}

function create_vultr_json(name, game_id, SCRIPTID, id = 403, region = 1) {
  return {
    DCID: region,
    OSID: 352,
    label: name,
    SCRIPTID: SCRIPTID,
    VPSPLANID: id,
    userdata: Buffer.from(game_id).toString("base64"),
  };
}
function createUniqueGameNumber() {
  return uuidv4();
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
exports.vultr = vultr;
