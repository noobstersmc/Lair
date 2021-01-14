const express = require("express");
const Joi = require("joi");
const router = express.Router();

router.post("/:id", (req, res) => {
    res.status(400).json({error:'er'})
});

module.exports = router;
