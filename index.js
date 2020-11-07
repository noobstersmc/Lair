const { urlencoded } = require("express");
const express = require("express");
const path = require("path");
const app = express();
const requestify = require('requestify');

//Pterodactyl, Vultr, and PORT
const PTERO_API = "FYMUQIEAK3b8kuSWuybqYFD20NKWqga3XjdFWBcz3ogAhbbW";
const PTERO_URL = "http://condor.jcedeno.us/";
const VULTR_API = "RSBCD6OMAKB6TNWS7PUBLGCLWKNTD36U7HGA";
const PORT = 8080;
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
//Starts the app
app.listen(PORT, () => console.log(`Condor landed in port ${PORT}`));

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
var vultr_request = {
  DCID: 1,
  OSID: 352,
  label: "NODE",
  SCRIPTID: 754163,
  VPSPLANID: 202,
  SSHKEYID:
    "5e23537673453,5ed1290013c2e,5ed1290013c2e,5f68c34ac21bc"
}
//Actually create the server function
async function create_server(request, response) {


  let creation_promise = vultr.server.create(create_vultr_json(request.body.host))
  let creation = await creation_promise;
  let id = parseInt(creation.SUBID);

  //TODO: IF IP = 0.0.0.0 Then repeat until finding actual IP
  console.log(id);
  var promise = vultr.server.list({
    SUBID: id
  });

  //Now talk to ptero
  let result = await promise;
  console.log(result);
  let ip = result.main_ip
  console.log("IP: " + ip)

  /*

  requestify.request("http://condor.jcedeno.us/api/application/nodes", {
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
    //Somewhat make this ip relationed to this update_url in a MAP
    var update_url = body.meta.resource;
    console.log(update_url)
    create_allocation_node(update_url, ip);

  }).catch((err) => console.log(err.getBody()));
*/
  response.send(request.body)
  console.log("Recieved request")
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
    VPSPLANID: 202,
    SSHKEYID:
      "5e23537673453,5ed1290013c2e,5ed1290013c2e,5f68c34ac21bc"
  }

}

