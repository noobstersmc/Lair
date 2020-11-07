const { urlencoded } = require("express");
const express = require("express");
const path = require("path");
const app = express();
const requestify = require('requestify');

//Pterodactyl, Vultr, and PORT
const PTERO_API = "pSMkBRPFJRxgsjzIXiHm6fuNqerVMQQQE6UOXb4BiVs8fio7";
const PTERO_URL = "http://condor.jcedeno.us/";
const VULTR_API = "RSBCD6OMAKB6TNWS7PUBLGCLWKNTD36U7HGA";
const PORT = 420;
//Map to keep track of Ips and Node IDS
const map = new Map();
//Test Values
map.set("69", 420);
map.set("72.184.69.100", 100)
//Vultr Api
const VultrNode = require('@vultr/vultr-node');
const vultr = VultrNode.initialize({
  apiKey: VULTR_API
}
)
//Body parse middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
//Should allow for data to be written.
app.post("/create-server", (req, res) => {
  if (authorized(req, res)) {
    create_server(req, res)
  }

});
//Get call to obtain self register
app.get("/self-register", (req, res) => {
  if (authorized(req, res)) {
    find_self_register_from_ip(req, res);
  }

});
app.get("/vultr/sizes", (req, res) => {
  console.log("Processing request of vultr sizes...")
  get_sizes().then((result) => {
    res.send(result);
    console.log("Done.")
  });
});
app.get("/vultr/locations", (req, res) => {
  console.log("Recieved request of locations list")
  vultr.regions.list().then((result)=>{
    res.send(result);
    console.log("Done.")
  });
});
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
      error: 404
    });
  } else {
    res.send({
      for_ip: ip,
      node_id: id,
      command: `cd /etc/pterodactyl && sudo wings configure --panel-url ${PTERO_URL} --token ${PTERO_API} --node ${id} --override`
    });

  }
}
//Actually create the server function
async function create_server(request, response) {

  let creation_promise = vultr.server.create(create_vultr_json(request.body.host))
  let creation = await creation_promise;
  let id = parseInt(creation.SUBID);
  console.log(id);

  var ip = await obtain_ip_from_subid(id);

  while (ip == "0.0.0.0") {
    await sleep(1000);
    ip = await obtain_ip_from_subid(id);
  }
  requestify.request(PTERO_URL + "api/application/nodes", {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PTERO_API}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: {
      name: `${request.body.host}`,
      location_id: 1,
      fqdn: ip,
      scheme: 'http',
      memory: 1000,
      disk: 100000,
      disk_overallocate: 0,
      memory_overallocate: 0,
      upload_size: 100,
      daemon_sftp: 2022,
      daemon_listen: 8080,
    },
    dataType: 'json'
  }).then((res) => {
    let body = res.getBody();
    var update_url = body.meta.resource;
    //Save the ip in map for /self-register
    map.set(ip, body.attributes.id);
    create_allocation_node(update_url, ip);

  }).catch((err) => console.log(err.getBody()));

  response.send(request.body)
  console.log(`Creating server for ${request.body.displayname} of type ${request.body.game_type} and seed ${request.body.extra_data.level_seed}`)
}
//Auth function
function authorized(request, respone) {
  if (request.headers.auth != "Condor-Secreto") {
    respone.status(401)
    respone.send({
      "error": "unauthorized"
    })
    return false;
  }
  return true;
}
async function obtain_ip_from_subid(id) {
  var promise = vultr.server.list({
    SUBID: id
  });
  let result = await promise;
  let coso = result.main_ip
  return coso;
}
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
function create_allocation_node(url, ipv4) {
  requestify.request(`${url}/allocations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PTERO_API}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: {
      ip: ipv4,
      ports: [
        "25565", "8081"
      ]
    },
    dataType: 'json'
  }).then((res) => {
    console.log("Reponse = " + res.code)
  }).catch((err) => console.log(err.getBody()));
}

function create_vultr_json(name) {
  return {
    DCID: 1,
    OSID: 352,
    label: name,
    SCRIPTID: 754163,
    VPSPLANID: 403,
    SSHKEYID:
      "5e23537673453,5ed1290013c2e,5ed1290013c2e,5f68c34ac21bc"
  }

}

