//Vultr Api
const VultrNode = require("@vultr/vultr-node");
const vultr = VultrNode.initialize({
  apiKey: "6BVHW5PVJ53WDFIOT77GPXN2L6K4IZOI5PKQ",
});

let uhc_run_url =
    "https://gist.githubusercontent.com/InfinityZ25/747362f81193e386015fac7515304ee8/raw/0ad16a99b63bfb99510e65a2f1ad352313176dc3/uhc-run-install.sh",
  uhc_url =
    "https://gist.github.com/InfinityZ25/747362f81193e386015fac7515304ee8/raw/0ad16a99b63bfb99510e65a2f1ad352313176dc3/uhc-install.sh";

/**
 * Creates a server instance with the given paramters.
 * @param {*} label
 * @param {*} tag
 * @param {*} plan
 * @param {*} install_url
 * @param {*} region
 * @param {*} os_id
 */
async function create_server(
  label = "condor-server",
  tag = "condor",
  plan = "vhf-2c-4gb",
  install_url = `${uhc_url}`,
  region = "ewr",
  os_id = "352"
) {
  let available_plans = await vultr.regions.listAvailableComputeInRegion({
    "region-id": region,
  });
  if (!available_plans.available_plans) {
    console.log("Plan not available");
    return;
  }

  let data = `#!/bin/bash \nbash -c "$(curl -fsSL ${
    install_url === "uhc-run"
      ? uhc_run_url
      : install_url === "uhc"
      ? uhc_url
      : install_url
  })" \nmkdir /root/server/condor ${
    tag === "Vandálico"
      ? "\ncurl https://gist.githubusercontent.com/InfinityZ25/23c14038abc0c327ac997bf81bcf7230/raw/03e6cecbaa80b1c6f0cc82f992d9e7ba6592dc56/vandal.json >> /root/server/whitelist.json"
      : ""
  }\necho "{\\"condor_id\\": \\"${label}\\"}" >> /root/server/condor/condor.json`;
  return await vultr.instances.createInstance({
    region,
    plan,
    os_id,
    label,
    tag,
    script_id: "6b4598e1-f5f2-4034-a85d-09c582d90bcf",
    user_data: Buffer.from(data).toString("base64"),
  });
}

/**
 * Deletes a server with if any one parameter is matched
 * @param {String} main_ip Optional IP to match
 * @param {String} id Optional id to match
 * @param {String} name Optional name or label to match
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

async function getAllVultrInstances() {
  let req = await vultr.instances.listInstances();
  return req.instances;
}

function uhcURL() {
  return uhc_url;
}
function uhcRunUrl() {
  return uhc_run_url;
}
exports.uhcURL = uhcURL;
exports.uhcRunURL = uhcRunUrl;
exports.createServer = create_server;
exports.deleteServer = deleteServer;
