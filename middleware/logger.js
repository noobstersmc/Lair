const moment = require("moment");

const logger = (req, res, next) => {
  /*console.log(
    `${req.protocol}://${req.hostname}${req.originalUrl} ${moment().format()}`
  );*/
  next();
};

module.exports = logger;
