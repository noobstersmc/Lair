var Twitter = require("twitter");

var client = new Twitter({
  consumer_key: "consumer_key",
  consumer_secret: "consumer_secret",
  access_token_key: "access_token_key",
  access_token_secret: "access_token_secret",
});

async function tweet(status) {
  return new Promise((resolve, reject) => {
    let params = { status: status };
    client.post("statuses/update", params, function (err, tweet, response) {
      if (err) {
        reject(err);
      }
      resolve(tweet);
    });
  });
}

exports.tweet = tweet;
