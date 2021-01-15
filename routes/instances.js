const router = require("express").Router();
const lair = require("../index");

//All routes here should be authenticated.
router.use((req, res, next) => {
  lair
    .authentication(req, res)
    .then((result) => {
      if (result === true) {
        next();
      } else return;
    })
    .catch((error) => {
      res.status(400).json({ error });
      return;
    });
});
//List all running instances
router.get("/", async (req, res) => {
  res.status(200).json({ instances: "test" });
});
//Create instance
router.post("/:id", async (req, res) => {
  //Verify input id
  let id = req.params.id;
  if (!id || id.length < 2) {
    res.status(400).json({ error: "No instance id provided" });
    return;
  }
  //Create an instance and post it to the database.
  
  //Respond
  res.status(200).json({ id });
});
//Get specific instance
router.get("/:id", async (req, res) => {
  //Verify input id
  let id = req.params.id;
  if (!id || id.length < 2) {
    res.status(400).json({ error: "No instance id provided" });
    return;
  }
  //Respond
  res.status(200).json({ id });
});

//Export routes
module.exports = router;
