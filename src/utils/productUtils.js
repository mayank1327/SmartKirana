
  // Check if product is low in stock
  const calculateIsLowStock = (product) => {
    return product.currentStock <= product.minStockLevel;
  };
  
  //Export all helper functions together
  module.exports = {
    calculateIsLowStock,
  };