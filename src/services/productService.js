const productRepository = require('../repositories/productRepository');
const { calculateProfitMargin, calculateProfitPercentage , calculateIsLowStock } = require('../utils/productUtils');

class ProductService {
  // Get all products with search and filtering
  async getAllProducts(query = {}) {

    const { search, lowStock, page = 1, limit = 10 } = query;
    
    let filter = this.getActiveFilter();
    
    let sortOption = { createdAt: -1 }; // Todo : enhance sorting based on query params
   
    // Default projection → only essential fields for list view
     let projection = { name: 1, unit: 1, currentStock: 1, isLowStock: 1 };

    // Search by name (text search)
    if (search) {
       filter.name = { $regex: search, $options: "i" };  // Case-insensitive partial match
    }
    
    
    // Filter low stock items
    if (lowStock === 'true') {
      filter.isLowStock = true; // TODO :return events driven notifications in future
    }
    // Pagination & sorting 
    const { products, total } = await productRepository.findAll(filter, { page, limit, sort: sortOption, projection });

    
    return {
      products: products.map(p => p.toObject()),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    };
  }
  
  // Get single product by ID
  async getProductById(id) {

    const product = await productRepository.findOne(this.getActiveFilter({_id : id})); // Ensure only active products

    if (!product) {
      throw new Error('Product not found'); // Better to use custom error classes in real apps
    }

    return {
      ...product.toObject(),
      profitMargin: calculateProfitMargin(product),
      profitMarginPercentage: calculateProfitPercentage(product),
      isLowStock: product.isLowStock
    };
  }
  
  // Create new product
  async createProduct(productData) {
  
    const { name } = productData;
    // Check if product with same name exists
    if(!name){ 
      throw new Error('Product name is required');
     }

    const existingProduct = await productRepository.findOne(
      this.getActiveFilter({name})// Only consider active products
    );
  
    if (existingProduct) {
      throw new Error('Product with this name already exists'); // Better to use custom error classes in real apps
    }


  // low stock flag
  const isLowStock = calculateIsLowStock(productData);

    
    const product = await productRepository.create({
    ...productData,
      isLowStock
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

  // ✅ Check duplicate name if name is being updated
  if (updateData.name && updateData.name !== product.name) {
    const existingProduct = await productRepository.findOne(
      this.getActiveFilter({ name: updateData.name })
    );
    
    if (existingProduct) {
      throw new Error('Product with this name already exists');
    }
  }

    Object.assign(product, updateData); // Merge updates

    // Recalculate if stock fields changed
     if ('currentStock' in updateData || 'minStockLevel' in updateData) {
      product.isLowStock = calculateIsLowStock(product); // Now has complete data
     }

     const updatedProduct = await productRepository.save(product);

   // Add computed fields for service response
  return {
    ...updatedProduct.toObject(),
  };
  }
  
  // Soft delete product
  async deleteProduct(id) {
    // Check if product exists and is active
    const product = await productRepository.findOne(this.getActiveFilter({ _id: id }));
  
    if (!product) {
      throw new Error('Product not found');
    }

    const deleteproduct = await productRepository.softDelete(id);
    
    return deleteproduct;
  }
  
  async getLowStockProducts(options = {}) {
    const { products, total, page, pages } = await productRepository.findLowStock(
      this.getActiveFilter(), 
      options
    );
    
    const enrichedProducts = products.map((p) => ({
      ...p.toObject(),
      profitMargin: calculateProfitMargin(p),
      profitMarginPercentage: calculateProfitPercentage(p),
    }));
  
    return {
      products: enrichedProducts,
      pagination: { current: page, pages, total }
    };
  }


  // Centralized filter for active products
   getActiveFilter(extra = {}) {
    return { isActive: true, ...extra };
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