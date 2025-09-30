const Product = require('../models/Product');

class ProductService {
  // Get all products with search and filtering
  async getAllProducts(query = {}) {
    const { search, category, lowStock, page = 1, limit = 10 } = query;
    
    let filter = { isActive: true };
    
    // Search by name (text search)
    if (search) {
      filter.$text = { $search: search };
    }
    
    // Filter by category
    if (category) {
      filter.category = category;
    }
    
    // Filter low stock items
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$currentStock', '$minStockLevel'] };
    }
    
    const skip = (page - 1) * limit;
    
    const products = await Product.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments(filter);

     // 👉 Add computed values at service layer
     const enrichedProducts = products.map((p) => ({
      ...p.toObject(),
      profitMargin: this.calculateProfitMargin(p),
      profitMarginPercentage: this.calculateProfitPercentage(p),
      isLowStock: this.needsLowStockAlert(p),
    }));

    
    return {
      products: enrichedProducts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    };
  }
  
  // Get single product by ID
  async getProductById(id) {
    const product = await Product.findById(id);
    if (!product || !product.isActive) {
      throw new Error('Product not found');
    }
    return {
      ...product.toObject(),
      profitMargin: this.calculateProfitMargin(product),
      profitMarginPercentage: this.calculateProfitPercentage(product),
      isLowStock: this.needsLowStockAlert(product),
    };
  }
  
  // Create new product
  async createProduct(productData) {
    // Check if product with same name exists
    const existingProduct = await Product.findOne({ 
      name: productData.name, 
      isActive: true 
    });
    
    if (existingProduct) {
      throw new Error('Product with this name already exists');
    }
    
    const product = await Product.create(productData);
    return product;
  }
  
  // Update product
  async updateProduct(id, updateData) {
    const product = await Product.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!product || !product.isActive) {
      throw new Error('Product not found');
    }
    
    return {
      ...product.toObject(),
      profitMargin: this.calculateProfitMargin(product),
      profitMarginPercentage: this.calculateProfitPercentage(product),
      isLowStock: this.needsLowStockAlert(product),
    };
  }
  
  // Soft delete product
  async deleteProduct(id) {
    const product = await Product.findByIdAndUpdate(
      id, 
      { isActive: false }, 
      { new: true }
    );
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    return product;
  }
  
  // Get low stock products
  async getLowStockProducts() {
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minStockLevel'] }
    }).sort({ currentStock: 1 });
    
    return products.map((p) => ({
      ...p.toObject(),
      profitMargin: this.calculateProfitMargin(p),
      profitMarginPercentage: this.calculateProfitPercentage(p),
      isLowStock: this.needsLowStockAlert(p),
    }));
  }

  // Helper to calculate profit margin
  calculateProfitMargin(product) {
    return product.sellingPrice - product.costPrice;
  }

  // Helper to calculate profit margin percentage
  calculateProfitPercentage(product) {
    if (product.costPrice === 0) return 0;
    return ((product.sellingPrice - product.costPrice) / product.costPrice) * 100;
  }

  // Helper to check if low stock alert is needed
  needsLowStockAlert(product) {
    return product.currentStock <= product.minStockLevel;
  }
}

module.exports = new ProductService();