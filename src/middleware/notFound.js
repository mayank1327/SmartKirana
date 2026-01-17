const notFound = (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Yeh page uplabhd nahi hai - Not Found'
    });
};
  
module.exports = notFound;