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
    
    return {
      products,
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
    return product;
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
    
    return product;
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
    
    return products;
  }
}

module.exports = new ProductService();