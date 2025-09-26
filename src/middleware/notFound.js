const notFound = (req, res) => {
    console.log("found nahi ho rha hai...")
    res.status(404).json({
      success: false,
      error: 'Route not found'
    });
  };
  
  module.exports = notFound;