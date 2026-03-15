const formatStockDisplay = (product) => {
    if (!product.variations || product.variations.length === 0) {
      return `${product.currentStock} units`;
    }
  
    const sorted = [...product.variations].sort(
      (a, b) => b.conversionToBase - a.conversionToBase
    );
  
    return sorted
      .map(v => `${Math.floor(product.currentStock / v.conversionToBase)} ${v.variationName}`)
      .join(' | ');
};
  
module.exports = { formatStockDisplay };