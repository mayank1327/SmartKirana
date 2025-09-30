const Product = require('../models/Product');

class ProductService {
  // Get all products with search and filtering
  async getAllProducts(query = {}) {
    const { search, category, lowStock, page = 1, limit = 10 } = query;
    
    let filter = this.getActiveFilter();
    
    // Search by name (text search)
    if (search) filter.$text = { $search: search };
    
    // Filter by category
    if (category) filter.category = category;
    
    // Filter low stock items
    if (lowStock === 'true') {
      filter.isLowStock = true;
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
      isLowStock: p.isLowStock,
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
    const product = await Product.findById(this.getActiveFilter({ _id: id }));
    if (!product) {
      throw new Error('Product not found');
    }
    return {
      ...product.toObject(),
      profitMargin: this.calculateProfitMargin(product),
      profitMarginPercentage: this.calculateProfitPercentage(product),
      isLowStock: product.isLowStock
    };
  }
  
  // Create new product
  async createProduct(productData) {
    // Check if product with same name exists
    const existingProduct = await Product.findOne(
      this.getActiveFilter({ name: productData.name })
    );
    
    if (existingProduct) {
      throw new Error('Product with this name already exists');
    }
    
    const product = await Product.create({
    ...productData,
     isLowStock: productData.currentStock <= productData.minStockLevel,
    });


    return product;
  }
  
  // Update product
  async updateProduct(id, updateData) {

    const product = await Product.findById(this.getActiveFilter({ _id: id }));
    if (!product || !product.isActive) {
       throw new Error('Product not found');
    }

     Object.assign(product, updateData);

    if ('currentStock' in updateData || 'minStockLevel' in updateData) {
       product.isLowStock = product.currentStock <= product.minStockLevel;
    }

   // Save updated document
    await product.save();

   // Add computed fields for service response
  return {
    ...product.toObject(),
    profitMargin: product.sellingPrice - product.costPrice,
    profitPercentage: product.costPrice ? ((product.sellingPrice - product.costPrice) / product.costPrice) * 100 : 0,
    isLowStock: product.isLowStock
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
    const products = await Product.find(
      this.getActiveFilter({ isLowStock: true })
    ).sort({ currentStock: 1 });
    
    return products.map((p) => ({
      ...p.toObject(),
      profitMargin: this.calculateProfitMargin(p),
      profitMarginPercentage: this.calculateProfitPercentage(p),
      isLowStock: p.isLowStock,
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

  // Centralized filter for active products
   getActiveFilter(extra = {}) {
    return { isActive: true, ...extra };
  }

}

module.exports = new ProductService();

// TODO: Future improvement
// 1. Move all DB calls to ProductRepository to separate persistence from business logic.
// 2. Consider MongoDB aggregation pipelines for profit/stock computations for large datasets.
// 3. Add event-driven notifications for low stock items instead of just returning a flag.