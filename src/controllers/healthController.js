const getHealthStatus = require("../utils/healthCheck");

const healthController = (req, res) => {
    res.json(getHealthStatus(req, res));
}

module.exports = healthController;