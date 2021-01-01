var Twitter = require("twitter");

var client = new Twitter({
  consumer_key: "jJBu4LOGaMYPR07QGZCYcKlVC",
  consumer_secret: "AG8YbYEaDkB69O9aq9TKCl6ikfzJTVYBWu6KEGcBoRegg4Zy4u",
  access_token_key: "1033123243400593410-2oOawFblTkFw2LnXtsymXsamefZVtp",
  access_token_secret: "EilXjoZcVsDADdxnV1AZfinqBTpgYMzopYwoUcPxZyPDM",
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
