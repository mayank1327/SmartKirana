const mongoose = require('mongoose');

const healthCheck = (req, res) => {
    const dbState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting

    res.json({
        status: 'OK',
        service: 'Kirana Inventory Server',
        environment: process.env.NODE_ENV,
        dbState: dbState,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
};

module.exports = healthCheck;