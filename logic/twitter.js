var Twitter = require("twitter");

var client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
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
