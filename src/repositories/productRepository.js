const Product = require('../models/Product');

class ProductRepository {
  // Fetch product by ID
  async findById(id, extraFilters = {}) {
    return Product.findOne({ _id: id, ...extraFilters });
  }

  // Fetch product by name
  async findByName(name, extraFilters = {}) {
    return Product.findOne({ name, ...extraFilters });
  }

  // Create new product
  async create(productData) {
    return Product.create(productData);
  }

  // Update product by ID
  async updateById(id, updateData, options = { new: true }) {
    return Product.findByIdAndUpdate(id, updateData, options);
  }

  // Soft delete product
  async softDeleteById(id) {
    return Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }

  // Find multiple products with filters, pagination, sorting
  async findAll(filters = {}, { page = 1, limit = 10, sort = { createdAt: -1 } } = {}) {
    const skip = (page - 1) * limit;
    const result = await Product.aggregate([
      { $match: filters },
      {
        $facet: {
          paginatedResults: [
            { $sort: sort },
            { $skip: skip },
            { $limit: parseInt(limit) }
          ],
          totalCount: [{ $count: 'count' }]
        }
      }
    ]);

    const products = result[0].paginatedResults;
    const total = result[0].totalCount[0]?.count || 0;

    return { products, total };
  }

  // Find low stock products
  async findLowStock(extraFilters = {}) {
    return Product.find({ isLowStock: true, ...extraFilters }).sort({ currentStock: 1 });
  }
}

module.exports = new ProductRepository();