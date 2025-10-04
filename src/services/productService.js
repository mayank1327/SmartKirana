const productRepository = require('../repositories/productRepository');

class ProductService {
  // Get all products with search and filtering
  async getAllProducts(query = {}) {

    const { search, category, lowStock, page = 1, limit = 10 } = query;
    
    let filter = this.getActiveFilter();
    
    let sortOption = { createdAt: -1 };
    let projection = {};

    // Search by name (text search)
    if (search) {
      sortOption = { score: { $meta: "textScore" }, createdAt: -1 };
      projection = { score: { $meta: "textScore" } };
      filter.$text = { $search: search };
    }
    
    // Filter by category
    if (category) filter.category = category;
    
    // Filter low stock items
    if (lowStock === 'true') {
      filter.isLowStock = true; // TODO :return events driven notifications in future
    }
    // Pagination & sorting 
    const { products, total } = await productRepository.findAll(filter, { page, limit, sort: sortOption, projection });

     // 👉 Add computed values at service layer
     const enrichedProducts = products.map((p) => ({
      ...p.toObject(), // Convert Mongoose doc to plain object
      profitMargin: this.calculateProfitMargin(p),
      profitMarginPercentage: this.calculateProfitPercentage(p),
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

    const product = await productRepository.findById(this.getActiveFilter({_id : id})); // Ensure only active products

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
    const { name } = productData;
    if(!name){ 
      throw new Error('Product name is required');
     }

    const existingProduct = await productRepository.findOne(
      this.getActiveFilter({name})// Only consider active products
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

     // Fetch existing product with active filter
     const product = await productRepository.findOne(
        this.getActiveFilter({ _id: id })   
     );
    
    if (!product) {
       throw new Error('Product not found'); // Better to use custom error classes in real apps
    }

    Object.assign(product, updateData); // Merge updates

    // Recalculate if stock fields changed
     if ('currentStock' in updateData || 'minStockLevel' in updateData) {
      product.isLowStock = this.calculateisLowStock(product); // Now has complete data
     }

     const updatedProduct = await productRepository.save(product);

   // Add computed fields for service response
  return {
    ...updatedProduct.toObject(),
    profitMargin: this.calculateProfitMargin(updatedProduct),
    profitPercentage: this.calculateProfitPercentage(updatedProduct),
    isLowStock: updatedProduct.isLowStock
  };
}
  
  // Soft delete product
  async deleteProduct(id) {
    const product = await productRepository.softDelete(id);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    return product;
  }
  
  // Get low stock products
  async getLowStockProducts() {
    const products = await productRepository.findLowStock(this.getActiveFilter());
    
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
    if (product.costPrice === 0) return 0; // ✅ Prevents division by zero!
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
// 2. Consider MongoDB aggregation pipelines for profit/stock computations for large datasets.
// 3. Add event-driven notifications for low stock items instead of just returning a flag.
// Future enhancement:
// Product.find(
//   { $text: { $search: search } },
//   { score: { $meta: 'textScore' } }
// ).sort({ score: { $meta: 'textScore' } });
// // Returns most relevant first