const productRepository = require('../repositories/productRepository');
const { calculateIsLowStock } = require('../utils/productUtils');

class ProductService {

  // Validate units according to business rules
  validateUnits(units, baseUnit) {
    // Rule 1: At least one unit must exist
    if (!units || units.length === 0) {
      throw new Error('At least one unit is required');
    }

    // Rule 2: Unit names must be unique (case-insensitive)
    const unitNames = units.map(u => u.unitName.toLowerCase());
    const uniqueNames = new Set(unitNames);
    if (unitNames.length !== uniqueNames.size) {
      throw new Error('Duplicate unit names are not allowed');
    }

    // Rule 3: Exactly one base unit must be selected
    const baseUnits = units.filter(u => u.isBase === true);
    if (baseUnits.length === 0) {
      throw new Error('Base unit must be selected');
    }
    if (baseUnits.length > 1) {
      throw new Error('Only one base unit can be selected');
    }

    // Rule 4: Base unit must be one of the defined units
    const baseUnitName = baseUnits[0].unitName.toLowerCase();
    if (!unitNames.includes(baseUnitName)) {
      throw new Error('Base unit must be from defined units');
    }

    return true;
  }

  // Validate variation chain according to business rules
  validateVariationChain(variations, baseUnitName) {
    // Rule 1: Must have at least one variation
    if (!variations || variations.length === 0) {
      throw new Error('At least one variation is required');
    }

    // Rule 2: Exactly one variation per unit
    const variationUnits = variations.map(v => v.unitName.toLowerCase());
    const uniqueUnits = new Set(variationUnits);
    if (variationUnits.length !== uniqueUnits.size) {
      throw new Error('Each unit must have exactly one variation');
    }

    // Rule 3: Base unit variation validation
    const baseVariation = variations.find(v => v.unitName.toLowerCase() === baseUnitName.toLowerCase());
    if (!baseVariation) {
      throw new Error('Base unit must have a variation');
    }
    
    // Base unit must contain itself × 1
    if (baseVariation.containsQuantity !== 1) {
      throw new Error('Base unit must contain quantity = 1');
    }
    if (baseVariation.containsUnit?.toLowerCase() !== baseUnitName.toLowerCase()) {
      throw new Error('Base unit must contain itself');
    }

    // Rule 4: Non-base variations must have valid containsQuantity and containsUnit
    const nonBaseVariations = variations.filter(v => v.unitName.toLowerCase() !== baseUnitName.toLowerCase());
    
    for (const variation of nonBaseVariations) {
      // Must have containsQuantity
      if (!variation.containsQuantity || variation.containsQuantity <= 0) {
        throw new Error(`${variation.unitName}: containsQuantity must be greater than 0`);
      }

      // Must have containsUnit
      if (!variation.containsUnit) {
        throw new Error(`${variation.unitName}: containsUnit is required`);
      }

      // containsUnit must be a valid unit (exists in variations)
      const containsUnitExists = variations.some(v => 
        v.unitName.toLowerCase() === variation.containsUnit.toLowerCase()
      );
      if (!containsUnitExists) {
        throw new Error(`${variation.unitName}: containsUnit "${variation.containsUnit}" does not exist`);
      }

      // Cannot contain itself (except base unit)
      if (variation.unitName.toLowerCase() === variation.containsUnit.toLowerCase()) {
        throw new Error(`${variation.unitName}: cannot contain itself`);
      }
    }

    // Rule 5: Check for circular dependencies
    const checkCircular = (startUnit, visited = new Set()) => {
      if (visited.has(startUnit.toLowerCase())) {
        // Found a cycle
        return true;
      }

      visited.add(startUnit.toLowerCase());

      // Find the variation for this unit
      const variation = variations.find(v => v.unitName.toLowerCase() === startUnit.toLowerCase());
      
      // If it's base unit, no cycle
      if (variation.unitName.toLowerCase() === baseUnitName.toLowerCase()) {
        return false;
      }

      // Check the unit it contains
      return checkCircular(variation.containsUnit, visited);
    };

    for (const variation of nonBaseVariations) {
      if (checkCircular(variation.unitName)) {
        throw new Error(`Circular dependency detected involving ${variation.unitName}`);
      }
    }

    // Rule 6: All variations must eventually resolve to base unit
    const resolvesToBase = (unitName) => {
      if (unitName.toLowerCase() === baseUnitName.toLowerCase()) {
        return true;
      }

      const variation = variations.find(v => v.unitName.toLowerCase() === unitName.toLowerCase());
      if (!variation) return false;

      return resolvesToBase(variation.containsUnit);
    };

    for (const variation of variations) {
      if (!resolvesToBase(variation.unitName)) {
        throw new Error(`${variation.unitName} does not resolve to base unit`);
      }
    }

    return true;
  }

  calculateConversionChain(variations, baseUnitName) {
    const conversionMap = new Map();

    // Recursive function to calculate conversion
    const calculateConversion = (unitName) => {
      // If already calculated, return it
      if (conversionMap.has(unitName.toLowerCase())) {
        return conversionMap.get(unitName.toLowerCase());
      }

      // Find the variation
      const variation = variations.find(v => v.unitName.toLowerCase() === unitName.toLowerCase());
      if (!variation) {
        throw new Error(`Variation not found for unit: ${unitName}`);
      }

      // Base unit conversion is 1
      if (variation.unitName.toLowerCase() === baseUnitName.toLowerCase()) {
        conversionMap.set(unitName.toLowerCase(), 1);
        return 1;
      }

      // Calculate recursively
      // conversionToBase = containsQuantity × conversionToBase(containsUnit)
      const containsUnitConversion = calculateConversion(variation.containsUnit);
      const thisConversion = variation.containsQuantity * containsUnitConversion;
      
      conversionMap.set(unitName.toLowerCase(), thisConversion);
      return thisConversion;
    };

    // Calculate for all variations
    for (const variation of variations) {
      calculateConversion(variation.unitName);
    }

    return conversionMap;
  }

  
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
