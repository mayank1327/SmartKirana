const productRepository = require('../repositories/productRepository');

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
    // Fetch from repository with pagination
    const { products, total } = await productRepository.findAll(filter, { page, limit, sort: { createdAt: -1 } });

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

    const product = await productRepository.findById(id , this.getActiveFilter()); // Ensure only active products

    if (!product) {
      throw new Error('Product not found'); // Better to use custom error classes in real apps
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
    const existingProduct = await productRepository.findOne(
      { name: productData.name }, this.getActiveFilter()// Only consider active products
    );
  
    if (existingProduct) {
      throw new Error('Product with this name already exists'); // Better to use custom error classes in real apps
    }
    
    const product = await productRepository.create({
    ...productData,
      isLowStock: this.calculateisLowStock(productData), // Determine low stock status on creation
    });


    return product;
  }
  
  // Update product
  async updateProduct(id, updateData) {
    
    if ('currentStock' in updateData || 'minStockLevel' in updateData) {
        updateData.isLowStock = this.calculateisLowStock(updateData);
    }
    
    const product = await productRepository.updateById( id , updateData , this.getActiveFilter()) // ensures only active products are updated)); 

    if (!product) {
       throw new Error('Product not found'); // Better to use custom error classes in real apps
    }

   // Add computed fields for service response
  return {
    ...product.toObject(),
    profitMargin: this.calculateProfitMargin(product),
    profitPercentage: this.calculateProfitPercentage(product),
    isLowStock: product.isLowStock
  };
}
  
  // Soft delete product
  async deleteProduct(id) {
    const product = await productRepository.softDeleteById(id);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    return product;
  }
  
  // Get low stock products
  async getLowStockProducts() {
    const products = await productRepository.findLowStock(
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

  // isLowStock is handled in create/update methods
  calculateisLowStock(product) {
    return product.currentStock <= product.minStockLevel;
  }

}

module.exports = new ProductService();

// TODO: Future improvement
// 1. Move all DB calls to ProductRepository to separate persistence from business logic.
// 2. Consider MongoDB aggregation pipelines for profit/stock computations for large datasets.
// 3. Add event-driven notifications for low stock items instead of just returning a flag.