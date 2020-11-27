
//Redis connection
const redis = require("redis");
const client = redis.createClient(
  "redis://Gxb1D0sbt3VoyvICOQKC8IwakpVdWegW@redis-11764.c73.us-east-1-2.ec2.cloud.redislabs.com:11764"
);
client.on("message", (channel, message) => {
  let delete_request = JSON.parse(message);
  console.log(channel, `Asked to destroy ${JSON.stringify(message_json)}`);
});
client.subscribe("destroy");