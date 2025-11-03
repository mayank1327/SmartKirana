//Calculate absolute profit margin
const calculateProfitMargin = (product) => {
    return product.sellingPrice - product.costPrice;
  };
  
  // Calculate profit margin percentage
  const calculateProfitPercentage = (product) => {
    if (product.costPrice === 0) return 0; // avoid division by zero
    return ((product.sellingPrice - product.costPrice) / product.costPrice) * 100;
  };
  
  // Check if product is low in stock
  const calculateIsLowStock = (product) => {
    return product.currentStock <= product.minStockLevel;
  };
  
  //Export all helper functions together
  module.exports = {
    calculateProfitMargin,
    calculateProfitPercentage,
    calculateIsLowStock,
  };