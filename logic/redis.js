//Redis connection
const redis = require("redis");
const lair = require("../Lair");

const pub = redis.createClient(
  "redis://Gxb1D0sbt3VoyvICOQKC8IwakpVdWegW@redis-11764.c73.us-east-1-2.ec2.cloud.redislabs.com:11764"
);
const client = redis.createClient(
  "redis://Gxb1D0sbt3VoyvICOQKC8IwakpVdWegW@redis-11764.c73.us-east-1-2.ec2.cloud.redislabs.com:11764"
);

pub.on("message", (channel, message) => {
  try {
    let delete_request = JSON.parse(message);
    console.log("delete request =", delete_request);
  
    if (delete_request.provider === "vultr") {
      lair.vultr.server.list({ main_ip: delete_request.ip }).then((response) => {
        if (response === undefined || response.length == 0) {
          console.log(`No server found with ip ${delete_request.ip}`);
          return;
        }
      
        for (servers in response) {
          lair.vultr.server
            .delete({ SUBID: parseInt(servers) })
            .then((delete_result) => console.log("Server has been deleted.", delete_result));
        }
      });
    } else {
      console.log(`${delete_request.provider} is not supported yet.`);
    }
    
  } catch (error) {
    console.log(error);
    
  }
});
pub.subscribe("destroy");

async function get_from(uuid){
  let promise = new Promise((resolve, reject) => {
    client.get("request:uuid", (e, data) => {
      if(e){
        reject(e);
      }
      resolve(data);
    });
  });
  return await promise;
}
async function getMatches(){

}

exports.redisConnection = client;
