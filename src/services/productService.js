const productRepository = require('../repositories/productRepository');
const { calculateIsLowStock } = require('../utils/productUtils');

class ProductService {
  // Get all products with search and filtering
  async getAllProducts(query = {}) {

    const { search, lowstock, page = 1, limit = 12 } = query;
    let filter = this.getActiveFilter();
    let sortOption = { createdAt: -1 }; // Todo : enhance sorting based on query params
    // Default projection → only essential fields for list view
     let projection = {name: 1,unit:1, currentStock: 1, minStockLevel:1, minSellingPrice:1, costPrice:1,  createdAt: 1 };
    // Search by name (text search)
    if (search) {
       filter.name = { $regex: search, $options: "i" };  // Case-insensitive partial match
    }
    if(lowstock === 'true'){ 
      filter.$expr = { $lte: [ "$currentStock", "$minStockLevel" ] }; // currentStock <= minStockLevel
    }
    // Pagination & sorting 
    const { products, total } = await productRepository.findAll(filter, { page, limit, sort: sortOption, projection });

    return {
      products: products.map(p => ({
        ...p.toObject(),
        isLowStock: calculateIsLowStock(p),
    })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    };
  }
  // Get single product by ID
  async getProductById(id) {
    try {
      const product = await productRepository.findOne(
        this.getActiveFilter({ _id: id })
      );
  
      if (!product) {
        const err = new Error('Product not found');
        err.statusCode = 404;
        throw err;
      }
  
      return {
        ...product.toObject(),
        isLowStock: calculateIsLowStock(product),
      };
  
    } catch (error) {
     // ✅ Handle invalid MongoDB ObjectId
    if (error.name === "CastError") {
      const err = new Error("Invalid product ID");
      err.statusCode = 404;
      throw err;
    }

    // ✅ If service already threw a 404, keep it
    if (error.statusCode === 404) {
      throw error;
    }

    // ✅ Unknown internal error → 500
    const err = new Error("Internal server error");
    err.statusCode = 500;
    throw err;
    }
  }
  // Create new product
  async createProduct(productData, session = null) {
  
    const { name } = productData;
    // Check if product with same name exists
    if(!name){ 
      throw new Error('Product name is required');
     }

    const existingProduct = await productRepository.findOne(
      this.getActiveFilter({name})
    );
  
    if (existingProduct) {
      const error = new Error('Product with this name already exists');
      error.statusCode = 400;
      throw error;
    }
    
    const product = await productRepository.create(productData, session);

    return product;
  }
  // Update product
  async updateProduct(id, updateData) {
    try{
     // Fetch existing product with active filter
     const product = await productRepository.findOne(
        this.getActiveFilter({ _id: id })   
     );
    
    if (!product) {
      const erorr =  new Error('Product not found');
      erorr.statusCode = 404; 
      throw erorr;
    }

  // ✅ Check duplicate name if name is being updated
  if (updateData.name && updateData.name !== product.name) {
    const existingProduct = await productRepository.findOne(
      this.getActiveFilter({ name: updateData.name })
    );
    
    if (existingProduct) {
      const error =  new Error('Product with this name already exists');
      error.statusCode = 400;
      throw error;
    }
  }

  if (updateData.currentStock !== undefined) {
    delete updateData.currentStock; // Prevent accidental/manual change
}

    Object.assign(product, updateData); // Merge updates

    const updatedProduct = await productRepository.save(product);

   // Add computed fields for service response
  return {
    ...updatedProduct.toObject(),
  };
} catch(error) {
    // ✅ invalid MongoDB ObjectId → 404
    if (error.name === "CastError") {
      const err = new Error("Invalid product ID");
      err.statusCode = 404;
      throw err;
    }

    // ✅ Already known error (400, 404)
    if (error.statusCode) {
      throw error;
    }

    // ✅ Anything else → 500
    const err = new Error("Internal server error");
    err.statusCode = 500;
    throw err;
}
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
  // Centralized filter for active products
   getActiveFilter(extra = {}) {
    return { isActive: true, ...extra };
  }

}

module.exports = new ProductService();
