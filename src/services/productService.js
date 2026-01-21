const mongoose = require('mongoose');
const productRepository = require('../repositories/productRepository');

class ProductService {
  
  // ==================== VALIDATION METHODS ====================

  // Validate units according to business rules
  validateUnits(units, baseUnit) {
    // Rule 1: At least one unit must exist
    if (!units || units.length === 0) {
      const error = new Error('At least one unit is required');
      error.status = 400;
      throw error;
    }

    // Rule 2: Unit names must be unique (case-insensitive)
    const unitNames = units.map(u => u.unitName.toLowerCase());
    const uniqueNames = new Set(unitNames);
    if (unitNames.length !== uniqueNames.size) {
      const error = new Error('Duplicate unit names are not allowed');
      error.status = 400;
      throw error;
    }

    // Rule 3: Exactly one base unit must be selected
    const baseUnits = units.filter(u => u.isBase === true);
    if (baseUnits.length === 0) {
      const error = new Error('Base unit must be selected');
      error.status = 400;
      throw error;
    }
    if (baseUnits.length > 1) {
      const error = new Error('Only one base unit can be selected');
      error.status = 400;
      throw error;
    }

    // Rule 4: Base unit must be one of the defined units
    const baseUnitName = baseUnits[0].unitName.toLowerCase();
    if (!unitNames.includes(baseUnitName)) {
      const error = new Error('Base unit must be from defined units');
      error.status = 400;
      throw error;
    }

    return true;
  }

  // Validate variation chain according to business rules
  validateVariationChain(variations, baseUnitName) {
    // Rule 1: Must have at least one variation
    if (!variations || variations.length === 0) {
      const error = new Error('At least one variation is required');
      error.status = 400;
      throw error;
    }

    // Rule 2: Exactly one variation per unit
    const variationUnits = variations.map(v => v.unitName.toLowerCase());
    const uniqueUnits = new Set(variationUnits);
    if (variationUnits.length !== uniqueUnits.size) {
      const error = new Error('Each unit must have exactly one variation');
      error.status = 400;
      throw error;
    }

    // Rule 3: Base unit variation validation
    const baseVariation = variations.find(v => v.unitName.toLowerCase() === baseUnitName.toLowerCase());
    if (!baseVariation) {
      const error = new Error('Base unit must have a variation');
      error.status = 400;
      throw error;
    }
    
    // Base unit must contain itself × 1
    if (baseVariation.containsQuantity !== 1) {
      const error = new Error('Base unit must contain quantity = 1');
      error.status = 400;
      throw error;
    }
    if (baseVariation.containsUnit?.toLowerCase() !== baseUnitName.toLowerCase()) {
      const error = new Error('Base unit must contain itself');
      error.status = 400;
      throw error;
    }

    // Rule 4: Non-base variations must have valid containsQuantity and containsUnit
    const nonBaseVariations = variations.filter(v => v.unitName.toLowerCase() !== baseUnitName.toLowerCase());
    
    for (const variation of nonBaseVariations) {
      // Must have containsQuantity
      if (!variation.containsQuantity || variation.containsQuantity <= 0) {
        const error = new Error(`${variation.unitName}: containsQuantity must be greater than 0`);
        error.status = 400;
        throw error;
      }

      // Must have containsUnit
      if (!variation.containsUnit) {
        const error = new Error(`${variation.unitName}: containsUnit is required`);
        error.status = 400;
        throw error;
      }

      // containsUnit must be a valid unit (exists in variations)
      const containsUnitExists = variations.some(v => 
        v.unitName.toLowerCase() === variation.containsUnit.toLowerCase()
      );
      if (!containsUnitExists) {
        const error = new Error(`${variation.unitName}: containsUnit "${variation.containsUnit}" does not exist`);
        error.status = 400;
        throw error;
      }

      // Cannot contain itself (except base unit)
      if (variation.unitName.toLowerCase() === variation.containsUnit.toLowerCase()) {
        const error = new Error(`${variation.unitName}: cannot contain itself`);
        error.status = 400;
        throw error;
      }
    }

    // Rule 5: Check for circular dependencies
    const checkCircular = (startUnit, visited = new Set()) => {
      if (visited.has(startUnit.toLowerCase())) {
        return true; // Found a cycle
      }

      visited.add(startUnit.toLowerCase());

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
        const error = new Error(`Circular dependency detected involving ${variation.unitName}`);
        error.status = 400;
        throw error;
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
        const error = new Error(`${variation.unitName} does not resolve to base unit`);
        error.status = 400;
        throw error;
      }
    }

    return true;
  }

  // ==================== CALCULATION METHODS ====================

  // Calculate conversion chain for all variations 
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

  // Derive missing MSPs based on provided MSP and conversion chain
  deriveMissingMSP(variations, conversionMap) {
    // Check if at least one MSP is provided
    const hasAnyMSP = variations.some(v => v.minSellingPrice != null && v.minSellingPrice > 0);
    
    // If no MSP provided at all, leave all as null (will be set during first purchase)
    if (!hasAnyMSP) {
      return variations.map(v => ({
        ...v,
        minSellingPrice: null
      }));
    }

    // Find the variation with MSP provided
    const variationWithMSP = variations.find(v => v.minSellingPrice != null && v.minSellingPrice > 0);
    
    if (!variationWithMSP) {
      return variations;
    }

    // Calculate MSP per base unit
    const mspPerBaseUnit = variationWithMSP.minSellingPrice / conversionMap.get(variationWithMSP.unitName.toLowerCase());

    // Derive MSP for all variations
    return variations.map(v => {
      // If MSP already provided, keep it
      if (v.minSellingPrice != null && v.minSellingPrice > 0) {
        return v;
      }

      // Calculate MSP for this variation
      const conversion = conversionMap.get(v.unitName.toLowerCase());
      const derivedMSP = mspPerBaseUnit * conversion;

      return {
        ...v,
        minSellingPrice: Math.round(derivedMSP * 100) / 100  // Round to 2 decimals
      };
    });
  }

  // Convert min stock level to base unit
  convertMinStockToBase(minStockLevel, conversionMap) {
    // If no min stock level provided, return null
    if (!minStockLevel || !minStockLevel.value) {
      return null;
    }

    const { value, unit } = minStockLevel;

    // Validate value
    if (value <= 0) {
      const error = new Error('Minimum stock level must be greater than 0');
      error.status = 400;
      throw error;
    }

    // Get conversion factor for this unit
    const conversion = conversionMap.get(unit.toLowerCase());
    
    if (!conversion) {
      const error = new Error(`Invalid unit for minimum stock level: ${unit}`);
      error.status = 400;
      throw error;
    }

    // Convert to base unit
    const minStockInBase = value * conversion;

    return minStockInBase;
  }

  // ==================== DISPLAY HELPER METHODS ====================

  // Format stock display (e.g., "5+ Cartons | 42 Packets | 3120 Pieces")
  formatStockDisplay(product) {
    const { currentStock, variations } = product;

    // Sort variations by conversionToBase DESC (biggest unit first)
    const sorted = [...variations].sort((a, b) => b.conversionToBase - a.conversionToBase);

    // Calculate stock in each variation
    const display = sorted.map(variation => {
      const quantity = Math.floor(currentStock / variation.conversionToBase);
      return `${quantity} ${variation.variationName}`;
    });

    return display.join(' | ');
  }

  // Get stock status color (green/yellow/red)
  getStockStatus(product) {
    const { currentStock, minStockLevel } = product;

    if (currentStock === 0) {
      return 'red';    // Out of stock
    }
    
    if (minStockLevel && currentStock <= minStockLevel) {
      return 'yellow'; // Low stock
    }
    
    return 'green';    // Good stock
  }

  // ==================== CRUD OPERATIONS ====================

  // Get all products
  async getAllProducts(query = {}, userId) {
    const { 
      search,           // Search by product name
      lowStock,         // Filter low stock products
      isActive = true,  // Filter active/inactive
      page = 1, 
      limit = 20 
    } = query;
  
    // Build filter
    let filter = { 
      userId,           // ✅ SECURITY: Only user's products
      isActive: isActive === 'true' || isActive === true
    };
  
    // Search by name
    if (search) {
      filter.productName = { $regex: search, $options: 'i' };
    }
  
    // Low stock filter
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$currentStock', '$minStockLevel'] };
    }
  
    // Pagination options
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };
  
    // Get products from repository
    const { products, total } = await productRepository.findAll(filter, options);
  
    // Format products with stock display
    const formattedProducts = products.map(product => {
      return {
        _id: product._id,
        productName: product.productName,
        stockDisplay: this.formatStockDisplay(product),
        stockStatus: this.getStockStatus(product),
        variations: product.variations.map(v => ({
          _id: v._id,
          variationName: v.variationName,
          minSellingPrice: v.minSellingPrice
        })),
        isActive: product.isActive,
        createdAt: product.createdAt
      };
    });
  
    return {
      products: formattedProducts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    };
  }

  // Get single product by ID
  async getProductById(productId, userId) {
    // Get product from repository
    const product = await productRepository.findById(productId);

    // Check if product exists
    if (!product) {
      const error = new Error('Product not found');
      error.status = 404;
      throw error;
    }

    // ✅ SECURITY: Check if product belongs to user
    if (product.userId.toString() !== userId.toString()) {
      const error = new Error('Unauthorized access to this product');
      error.status = 403;
      throw error;
    }

    // Check if product is active
    if (!product.isActive) {
      const error = new Error('Product not found');
      error.status = 404;
      throw error;
    }

    // Format response with stock display
    return {
      _id: product._id,
      productName: product.productName,
      baseUnit: product.baseUnit,
      units: product.units,
      variations: product.variations,
      costPricePerBaseUnit: product.costPricePerBaseUnit,
      currentStock: product.currentStock,
      stockDisplay: this.formatStockDisplay(product),
      minStockLevel: product.minStockLevel,
      stockStatus: this.getStockStatus(product),
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
  }

  // Create new product 
  async createProduct(productData, userId) {
    const { productName, units, variations, minStockLevel } = productData;

    // ✅ Check for duplicate product name (case-insensitive)
    const existingProduct = await productRepository.findOne({
      productName: { $regex: new RegExp(`^${productName}$`, 'i') },
      userId,
      isActive: true
    });

    if (existingProduct) {
      const error = new Error('Product with this name already exists');
      error.status = 400;
      throw error;
    }

    // Step 1: Find base unit
    const baseUnit = units.find(u => u.isBase === true);
    if (!baseUnit) {
      const error = new Error('Base unit not found');
      error.status = 400;
      throw error;
    }
    const baseUnitName = baseUnit.unitName;

    // Step 2: Validate units
    this.validateUnits(units, baseUnitName);

    // Step 3: Validate variation chain
    this.validateVariationChain(variations, baseUnitName);

    // Step 4: Calculate conversion chain
    const conversionMap = this.calculateConversionChain(variations, baseUnitName);

    // Step 5: Derive missing MSP
    const variationsWithMSP = this.deriveMissingMSP(variations, conversionMap);

    // Step 6: Convert min stock level to base unit
    const minStockInBase = this.convertMinStockToBase(minStockLevel, conversionMap);

    // Step 7: Build database document
    // First, create units with IDs
    const unitsWithIds = units.map(u => ({
      _id: new mongoose.Types.ObjectId(),
      unitName: u.unitName.toLowerCase(),
      isBaseUnit: u.isBase
    }));

    // Find base unit from unitsWithIds
    const baseUnitDoc = unitsWithIds.find(u => u.isBaseUnit === true);

    // Build variations with IDs and references
    const variationsWithIds = variationsWithMSP.map(v => {
      // Find the unitId for this variation
      const unitDoc = unitsWithIds.find(u => u.unitName === v.unitName.toLowerCase());
      
      // Find the containsUnitId
      const containsUnitDoc = unitsWithIds.find(u => u.unitName === v.containsUnit?.toLowerCase());

      return {
        _id: new mongoose.Types.ObjectId(),
        unitId: unitDoc._id,
        variationName: v.unitName,
        containsQuantity: v.containsQuantity || 1,
        containsUnitId: containsUnitDoc?._id || unitDoc._id,
        conversionToBase: conversionMap.get(v.unitName.toLowerCase()),
        minSellingPrice: v.minSellingPrice
      };
    });

    const productDoc = {
      productName,
      userId,
      baseUnit: {
        _id: baseUnitDoc._id,
        unitName: baseUnitDoc.unitName
      },
      units: unitsWithIds,
      variations: variationsWithIds,
      costPricePerBaseUnit: null,
      currentStock: 0,
      minStockLevel: minStockInBase,
      isActive: true
    };

    // Step 8: Save to database via repository
    const product = await productRepository.create(productDoc);

    // Step 9: Format response
    return {
      _id: product._id,
      productName: product.productName,
      currentStock: product.currentStock,
      stockDisplay: this.formatStockDisplay(product),
      message: 'Product created successfully'
    };
  }

  // // Update product (edit allowed fields only)
  // async updateProduct(productId, updateData, userId) {
  //   // Get existing product
  //   const product = await productRepository.findById(productId);

  //   if (!product) {
  //     const error = new Error('Product not found');
  //     error.status = 404;
  //     throw error;
  //   }

  //   // ✅ SECURITY: Check ownership
  //   if (product.userId.toString() !== userId.toString()) {
  //     const error = new Error('Unauthorized access to this product');
  //     error.status = 403;
  //     throw error;
  //   }

  //   if (!product.isActive) {
  //     const error = new Error('Product not found');
  //     error.status = 404;
  //     throw error;
  //   }

  //   // ✅ Allowed editable fields (per Phase 2 doc)
  //   const allowedUpdates = {
  //     productName: updateData.productName,
  //     minStockLevel: updateData.minStockLevel,
  //     isActive: updateData.isActive
  //   };

  //   // Update MSP for variations if provided
  //   if (updateData.variations && Array.isArray(updateData.variations)) {
  //     for (const updatedVar of updateData.variations) {
  //       const variation = product.variations.find(v => v._id.toString() === updatedVar.variationId);
  //       if (variation && updatedVar.minSellingPrice !== undefined) {
  //         variation.minSellingPrice = updatedVar.minSellingPrice;
  //       }
  //     }
  //   }

  //   // Apply allowed updates
  //   Object.keys(allowedUpdates).forEach(key => {
  //     if (allowedUpdates[key] !== undefined) {
  //       product[key] = allowedUpdates[key];
  //     }
  //   });

  //   // Save updated product
  //   const updatedProduct = await productRepository.save(product);

  //   return {
  //     _id: updatedProduct._id,
  //     productName: updatedProduct.productName,
  //     stockDisplay: this.formatStockDisplay(updatedProduct),
  //     message: 'Product updated successfully'
  //   };
  // }

  // Soft delete product
  async deleteProduct(productId, userId) {
    const product = await productRepository.findById(productId);

    if (!product) {
      const error = new Error('Product not found');
      error.status = 404;
      throw error;
    }

    // ✅ SECURITY: Check ownership
    if (product.userId.toString() !== userId.toString()) {
      const error = new Error('Unauthorized access to this product');
      error.status = 403;
      throw error;
    }

    // Soft delete
    product.isActive = false;
    await productRepository.save(product);

    return {
      message: 'Product deleted successfully'
    };
  }
}

module.exports = new ProductService();

module.exports = new ProductService();
