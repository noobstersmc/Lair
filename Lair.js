const { urlencoded } = require("express");
const express = require("express");
const path = require("path");
const app = express();
const requestify = require("requestify");

//Pterodactyl, Vultr, and PORT
const PTERO_API = "pSMkBRPFJRxgsjzIXiHm6fuNqerVMQQQE6UOXb4BiVs8fio7";
const PTERO_URL = "http://condor.jcedeno.us/";
const VULTR_API = "RSBCD6OMAKB6TNWS7PUBLGCLWKNTD36U7HGA";
const PORT = 420;
//Map to keep track of Ips and Node IDS
const map = new Map();
//Test Values
map.set("69", 420);
map.set("72.184.69.100", 100);
//Vultr Api
const VultrNode = require("@vultr/vultr-node");
const vultr = VultrNode.initialize({
  apiKey: VULTR_API,
});
//Body parse middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
//Should allow for data to be written.
app.post("/create-server", (req, res) => {
  if (authorized(req, res)) {
    create_server(req, res);
  }
});
//Get call to obtain self register
app.get("/self-register", (req, res) => {
  if (authorized(req, res)) {
    find_self_register_from_ip(req, res);
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
let vultr_api_url = "https://api.vultr.com/v2/";
app.get("/vultr/servers/v2", (req, res) => {
  console.log("Recieved request of active server list");
  //Call to the vultr v2 api rest
  let input = req.query.ip;
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
      console.log(req.params.ip);

      res.sendStatus(404);
    });
});
//

//Starts the app
app.listen(PORT, () => console.log(`Condor landed in port ${PORT}`));
//Async function to get vultr available sizes
async function get_sizes() {
  var promise = vultr.plans.list();
  let result = await promise;
  return result;
}
//Function to obtain self-register
function find_self_register_from_ip(req, res) {
  let body = req.body;
  let ip = body.ip;
  console.log(ip + " is being asked.");
  let id = map.get(ip);
  if (id == undefined) {
    res.send({
      error: 404,
    });
  } else {
    res.send({
      for_ip: ip,
      node_id: id,
      command: `cd /etc/pterodactyl && sudo wings configure --panel-url ${PTERO_URL} --token ${PTERO_API} --node ${id} --override`,
    });
  }
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
  //Create a promise to await for the vultr server to be ready.
  let creation_promise = vultr.server.create(
    create_vultr_json(
      request.body.host,
      instance_input.plan_id,
      instance_input.region_id
    )
  );
  //Await the promise
  let creation = await creation_promise;
  //Parse the instance SUBID from vultr to an Int.
  let id = parseInt(creation.SUBID);
  //Obtain the IP, await for it
  var ip = await obtain_ip_from_subid(id);
  //Loop until getting an actual response.
  while (ip == "0.0.0.0") {
    //execute every 1s (1000ms)
    await sleep(1000);
    ip = await obtain_ip_from_subid(id);
  }
  //Register the node in pterodactyl
  var node_create = el(request, instance_input, ip);
  let node_result = await node_create;

  let body = node_result.getBody();
  map.set(ip, body.attributes.id);
  var update_url = body.meta.resource;
  //Allocate the ips
  var node_ip_allocation = add_ip(update_url, ip);
  await node_ip_allocation;
  //Create the request to
  var get_ip_id = get_allocation_from_ip(update_url, ip, 25565);
  let allocation_id = await get_ip_id;
  if (allocation_id == undefined) {
    console.log(`No allocation ip found for ${ip}`);
  }
  response.send(request.body);
  console.log(
    `Creating server for ${request.body.displayname} of type ${request.body.game_type} and seed ${request.body.extra_data.level_seed}`
  );
  
  setTimeout(() => {
    console.log("Coso");
    var game_server_promise = create_game_server_ptero(request.body, instance_input, allocation_id);
    let game_server_result = await game_server_promise;
    console.log(game_server_result.getBody());
  }, 180000);

}
async function create_game_server_ptero(
  request_body,
  instance_input,
  allocation_id
) {
  let promise = requestify.request(`${PTERO_URL}api/application/servers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PTERO_API}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: {
      name: request_body.host,
      user: 1,
      egg: request_body.game_type == "UHC" ? 15 : 16,
      docker_image: "noobstersmc/condor-graal:1.0",
      startup: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
      limits: {
        memory: instance_input.ram,
        swap: 0,
        disk: 0,
        cpu: 0,
        io: 500,
      },
      feature_limits: {
        databases: 0,
        backups: 0,
      },
      allocation: {
        default: allocation_id,
      },
      //ENVIRONMENT
      environment: {
        SERVER_JARFILE: "server.jar",
        GAME_SEED: request_body.extra_data.level_seed,
        DL_PATH:
          "https://ci.codemc.io/job/YatopiaMC/job/Yatopia/job/ver%252F1.16.3/lastSuccessfulBuild/artifact/target/yatopia-1.16.3-paperclip-b134.jar",
      },
    },
    dataType: "json",
  });
  try {
    let result = await promise;
    console.log(result);
  } catch (error) {
    console.log("Error found");
  }
}

async function get_allocation_from_ip(node_url, from_ip, port) {
  var promise = requestify.request(`${node_url}/allocations`, {
    method: "GET",
    dataType: "json",
    headers: {
      Authorization: `Bearer ${PTERO_API}`,
    },
  });
  let result = await promise;
  let list = result.getBody().data;
  //Filter the allocation
  var id = 0;
  list.forEach((allocation) => {
    let attributes = allocation.attributes;
    if (attributes.ip == from_ip && attributes.port == port) {
      console.log(`ID for ${from_ip}:${port} is ${attributes.id}`);
      id = attributes.id;
    }
  });
  return id;
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
      console.log(`${instance_type.plan} is undefined`);
    }
    //Obtain a region ID understandable by vultr api
    response.region_id = region_id_from_name(instance_type.region);
    if (response.region_id == undefined) {
      console.log(`${instance_type.plan} is undefined`);
      response.region_id = 1;
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
  if (region == "nyc" || region == "nj" || region == "ewr" || region == "us") {
    return 1;
  }
  if (region == "tx" || region == "dfw") {
    return 3;
  }
  if (region == "fr" || region == "cdg" || region == "eu") {
    return 24;
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
async function add_ip(url, ipv4) {
  let promise = requestify.request(`${url}/allocations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PTERO_API}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: {
      ip: ipv4,
      ports: ["25565", "8081"],
    },
    dataType: "json",
  });
  let result = await promise;
  return "completed";
}
async function el(request, instance_input, ip) {
  var promise = requestify.request(PTERO_URL + "api/application/nodes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PTERO_API}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: {
      name: `${request.body.host}`,
      location_id: 1,
      fqdn: ip,
      scheme: "http",
      memory: instance_input.ram,
      disk: instance_input.disk,
      disk_overallocate: 0,
      memory_overallocate: 0,
      upload_size: 100,
      daemon_sftp: 2022,
      daemon_listen: 8080,
    },
    dataType: "json",
  });
  let result = await promise;
  return result;
}
async function obtain_ip_from_subid(id) {
  var promise = vultr.server.list({
    SUBID: id,
  });
  let result = await promise;
  let coso = result.main_ip;
  return coso;
}
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function create_vultr_json(name, id = 403, region = 1) {
  return {
    DCID: region,
    OSID: 352,
    label: name,
    SCRIPTID: 754163,
    VPSPLANID: id,
    SSHKEYID: "5e23537673453,5ed1290013c2e,5ed1290013c2e,5f68c34ac21bc",
  };
}
