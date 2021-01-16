//Vultr Api
const VultrNode = require("@vultr/vultr-node");
const { json } = require("express");
const { func } = require("joi");
const vultr = VultrNode.initialize({
  apiKey: "6BVHW5PVJ53WDFIOT77GPXN2L6K4IZOI5PKQ",
});
const { v4: uuidv4 } = require("uuid");

let uhc_run_url =
    "https://gist.githubusercontent.com/InfinityZ25/747362f81193e386015fac7515304ee8/raw/0ad16a99b63bfb99510e65a2f1ad352313176dc3/uhc-run-install.sh",
  uhc_url =
    "https://gist.github.com/InfinityZ25/747362f81193e386015fac7515304ee8/raw/0ad16a99b63bfb99510e65a2f1ad352313176dc3/uhc-install.sh";
/**
 * run script = 1bb53731-cf81-454d-991d-ead339b32849
 * uhc script = 3310f0fa-02f1-41d8-89fd-2f20d405298b
 */

async function create_server(
  label = "condor-server",
  plan = "vhf-2c-4gb",
  script_id = "3310f0fa-02f1-41d8-89fd-2f20d405298b",
  region = "ewr",
  os_id = "352",
  user_data = "",
  tag = "condor"
) {
  let available_plans = await vultr.regions.listAvailableComputeInRegion({
    "region-id": region,
  });
  if (!available_plans.available_plans) {
    console.log("Plan not available");
    return;
  }

  let data = `#!/bin/bash \nbash -c "$(curl -fsSL ${uhc_run_url})" \nmkdir /root/server/condor \necho "{\\"condor_id\\": \\"${label}\\"}" >> /root/server/condor/condor.json`;
  return await vultr.instances.createInstance({
    region,
    plan,
    os_id,
    script_id,
    label,
    tag: "development",
    user_data: Buffer.from(data).toString("base64"),
  });
}

async function getAllVultrInstances() {
  let req = await vultr.instances.listInstances();
  return req.instances;
}
/**
 * Deletes a server with if any one parameter is matched
 * @param {*} main_ip Optional IP to match
 * @param {*} id Optional id to match
 * @param {*} name Optional name or label to match
 */
async function deleteServer(main_ip, id, name) {
  //Ask for all the currently running instances
  let instances = await getAllVultrInstances();
  var match;

  //Find a server matching any of the parameters in vultr
  for (servers in instances) {
    if (
      instances[servers].id == id ||
      instances[servers].main_ip == main_ip ||
      instances[servers].label == name
    ) {
      match = instances[servers];
      break;
    }
  }
  //If a match was found then delete it
  if (match) {
    //Submit delete request
    await vultr.instances.deleteInstance({
      "instance-id": match.id,
    });

    return { result: "ok" };
  } else {
    return { error: "no_instance_found" };
  }
}
async function run() {
  //console.log(await vultr.sshKeys.listSshKeys());

  console.log(
    await create_server(
      (label = `${uuidv4()}`),
      (plan = "vc2-1c-2gb"),
      (script_id = "6b4598e1-f5f2-4034-a85d-09c582d90bcf")
    )
  );
  /*
  let re = await deleteServer(
    null,
    null,
    "692e2149-0952-4216-b391-c9cf61a2e317"
  );
  console.log(re);
  */
}
run();
