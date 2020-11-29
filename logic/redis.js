//Redis connection
const redis = require("redis");
const lair = require("../Lair");
const client = redis.createClient(
  "redis://Gxb1D0sbt3VoyvICOQKC8IwakpVdWegW@redis-11764.c73.us-east-1-2.ec2.cloud.redislabs.com:11764"
);
client.on("message", (channel, message) => {
  let delete_request = JSON.parse(message);
  console.log(channel, `Asked to destroy ${JSON.stringify(message_json)}`);
  vultr.server.list({ main_ip: delete_request.ip }).then((response) => {
    for (servers in response) {
      vultr.server
        .delete({ SUBID: servers })
        .then((__) => console.log("Server has been deleted."));
    }
  });
});
client.subscribe("destroy");

